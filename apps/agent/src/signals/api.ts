// API signal listener
// Monitors external APIs: flights, weather, stocks, custom endpoints
import { Logger } from '../utils/logger.js';

const logger = new Logger('APISignal');

export class APISignal {
    private baseUrl: string = '';
    private registeredTriggers: Map<string, any> = new Map();

    async register(trigger: string, conditions: any) {
        this.registeredTriggers.set(trigger, conditions);
        logger.info(`Registered API trigger: ${trigger}`);
    }

    async check(trigger: string, conditions: any): Promise<any> {
        switch (trigger) {
            case 'flight.delayed':
                return await this.checkFlightDelay(conditions);
            case 'flight.status':
                return await this.checkFlightStatus(conditions);
            case 'weather.condition':
                return await this.checkWeather(conditions);
            case 'stock.price':
                return await this.checkStockPrice(conditions);
            case 'page.views':
                return await this.checkPageViews(conditions);
            default:
                return await this.checkCustomAPI(trigger, conditions);
        }
    }

    private async checkFlightDelay(conditions: any): Promise<any> {
        try {
            // AviationStack API
            const apiKey = process.env.AVIATIONSTACK_API_KEY;
            if (!apiKey) {
                logger.warn('No AviationStack API key');
                return null;
            }

            const flightIata = conditions.flight_iata;
            if (!flightIata) return null;

            const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightIata}`;
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const flight = data.data[0];
                const delayMinutes = flight.departure?.delay || 0;
                const delayHours = delayMinutes / 60;

                if (delayHours >= (conditions.delay_hours || 2)) {
                    logger.info(`Flight ${flightIata} delayed by ${delayHours.toFixed(1)} hours`);
                    return {
                        flight: {
                            iata: flightIata,
                            delay_minutes: delayMinutes,
                            delay_hours: delayHours,
                            status: flight.flight_status,
                            departure: flight.departure,
                            arrival: flight.arrival,
                        },
                    };
                }
            }

            return null;
        } catch (error) {
            logger.error('Flight delay check failed:', error);
            return null;
        }
    }

    private async checkFlightStatus(conditions: any): Promise<any> {
        try {
            const apiKey = process.env.AVIATIONSTACK_API_KEY;
            if (!apiKey) return null;

            const flightIata = conditions.flight_iata;
            const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightIata}`;
            
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const flight = data.data[0];
                return { flight };
            }

            return null;
        } catch (error) {
            logger.error('Flight status check failed:', error);
            return null;
        }
    }

    private async checkWeather(conditions: any): Promise<any> {
        try {
            // OpenWeatherMap API
            const apiKey = process.env.OPENWEATHER_API_KEY;
            if (!apiKey) return null;

            const city = conditions.city || 'Jakarta';
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
            
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            
            const weather = {
                city,
                temp: data.main?.temp,
                condition: data.weather?.[0]?.main,
                description: data.weather?.[0]?.description,
                humidity: data.main?.humidity,
                wind_speed: data.wind?.speed,
            };

            // Check if condition matches
            if (conditions.weather_condition) {
                if (weather.condition?.toLowerCase().includes(conditions.weather_condition.toLowerCase())) {
                    return { weather };
                }
            } else {
                return { weather };
            }

            return null;
        } catch (error) {
            logger.error('Weather check failed:', error);
            return null;
        }
    }

    private async checkStockPrice(conditions: any): Promise<any> {
        try {
            // Alpha Vantage API
            const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
            if (!apiKey) return null;

            const symbol = conditions.symbol;
            if (!symbol) return null;

            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
            
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            const quote = data['Global Quote'];

            if (quote) {
                const price = parseFloat(quote['05. price']);
                const targetPrice = conditions.target_price;

                if (targetPrice) {
                    const condition = conditions.price_condition || 'above';
                    if (condition === 'above' && price >= targetPrice) {
                        return { stock: { symbol, price, target: targetPrice } };
                    }
                    if (condition === 'below' && price <= targetPrice) {
                        return { stock: { symbol, price, target: targetPrice } };
                    }
                } else {
                    return { stock: { symbol, price } };
                }
            }

            return null;
        } catch (error) {
            logger.error('Stock price check failed:', error);
            return null;
        }
    }

    private async checkPageViews(conditions: any): Promise<any> {
        try {
            // Google Analytics or custom endpoint
            const endpoint = conditions.endpoint;
            if (!endpoint) return null;

            const response = await fetch(endpoint);
            if (!response.ok) return null;

            const data = await response.json();
            
            const views = data.views || data.count || 0;
            const threshold = conditions.threshold || 1000;

            if (views >= threshold) {
                return { page: { views, threshold } };
            }

            return null;
        } catch (error) {
            logger.error('Page views check failed:', error);
            return null;
        }
    }

    private async checkCustomAPI(trigger: string, conditions: any): Promise<any> {
        try {
            const endpoint = conditions.endpoint;
            if (!endpoint) return null;

            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };

            if (conditions.headers) {
                Object.assign(headers, conditions.headers);
            }

            const response = await fetch(endpoint, { headers });
            if (!response.ok) return null;

            const data = await response.json();
            
            // Apply JSONPath-like conditions
            let result = data;
            if (conditions.json_path) {
                const paths = conditions.json_path.split('.');
                for (const path of paths) {
                    result = result?.[path];
                }
            }

            return { custom: { trigger, data: result } };
        } catch (error) {
            logger.error('Custom API check failed:', error);
            return null;
        }
    }
}
