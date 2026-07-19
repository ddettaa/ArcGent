// ArcGent entry point
import ArcGent from './agent.js';

const agent = new ArcGent();

console.log(`
╔═══════════════════════════════════════════════╗
║              🤖 ArcGent v0.1.0              ║
║   Autonomous Signal-to-Payment Agent         ║
║   Arc + Circle Agent Stack                    ║
╚═══════════════════════════════════════════════╝
`);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down ArcGent...');
    process.exit(0);
});

// Start agent
agent.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
