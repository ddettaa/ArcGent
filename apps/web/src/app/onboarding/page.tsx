"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { CheckCircle, ArrowRight, Wallet, Settings, Zap } from "lucide-react";

const C = {
  sand: "#f4f0e6", ink: "#0b1a33", ocean: "#1b3158",
  steel: "#2f578c", coral: "#ff4b31", mint: "#5acda7", purple: "#9f72ff",
  gold: "#f2a43a",
};

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
}

export default function OnboardingPage() {
  const { address, isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myAgent, setMyAgent] = useState<any>(null);

  // Fetch templates on mount
  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(setTemplates)
      .catch(console.error);
  }, []);

  // Auto-provision agent when wallet connects
  useEffect(() => {
    if (!isConnected || !address) return;
    const wallet = address;
    fetch("/api/my-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Wallet-Address": wallet },
      body: JSON.stringify({ walletAddress: wallet }),
    })
      .then(r => r.json())
      .then(agent => setMyAgent(agent))
      .catch(console.error);
  }, [isConnected, address]);

  const steps: OnboardingStep[] = [
    {
      id: "connect",
      title: "Connect Wallet",
      description: "Link your wallet to get started",
      icon: Wallet,
      completed: isConnected,
    },
    {
      id: "template",
      title: "Pick a Template",
      description: "Choose a pre-built scenario",
      icon: Settings,
      completed: !!selectedTemplate,
    },
    {
      id: "configure",
      title: "Configure Rules",
      description: "Set your payment parameters",
      icon: Settings,
      completed: Object.keys(formData).length > 0,
    },
    {
      id: "activate",
      title: "Activate Agent",
      description: "Start monitoring and paying",
      icon: Zap,
      completed: false,
    },
  ];

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentStep(2);
  };

  const handleFormSubmit = async () => {
    if (!selectedTemplate) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate}/instantiate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(address ? { "X-Wallet-Address": address } : {}),
        },
        body: JSON.stringify({
          ...formData,
          recipient: address,
          ownerAddress: address,
        }),
      });
      
      if (res.ok) {
        setCurrentStep(3);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div style={{ minHeight: "100vh", background: C.sand, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 3%", borderBottom: `1px solid rgba(11,26,51,0.1)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "grid", placeItems: "center", width: 33, height: 33, color: "white", background: C.ocean, fontSize: 11, borderRadius: 4 }}>AG</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.ink }}>ArcGent Onboarding</div>
            <div style={{ fontSize: 11, color: C.steel }}>Get your AI agent running in 3 steps</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "40px 3%", maxWidth: 800, margin: "0 auto" }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 8, marginBottom: 40 }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center",
                background: step.completed ? C.mint : i === currentStep ? C.ocean : "rgba(11,26,51,0.1)",
                color: step.completed || i === currentStep ? "white" : C.steel,
                fontSize: 12, fontWeight: 700,
              }}>
                {step.completed ? <CheckCircle size={16} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 40, height: 2, background: "rgba(11,26,51,0.1)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Connect Wallet */}
        {currentStep === 0 && (
          <div style={{ background: "white", padding: 32, borderRadius: 12, border: `1px solid rgba(11,26,51,0.1)` }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 900 }}>Connect Your Wallet</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: C.steel }}>
              Connect your wallet to receive payments and manage your agent. We support MetaMask, Rabby, and other Web3 wallets.
            </p>
            <WalletConnect />
            {isConnected && (
              <div style={{ marginTop: 16, padding: 12, background: "rgba(90,205,167,0.1)", borderRadius: 8, fontSize: 12, color: C.mint }}>
                ✅ Wallet connected: {address}
              </div>
            )}
            {myAgent && (
              <div style={{ marginTop: 8, padding: 12, background: "rgba(159,114,255,0.08)", borderRadius: 8, fontSize: 12, color: C.purple }}>
                🤖 Agent created: <strong>{myAgent.name}</strong> ({myAgent.id})
              </div>
            )}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setCurrentStep(1)}
                disabled={!isConnected}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "12px 24px",
                  background: C.ocean, color: "white", border: "none", borderRadius: 6,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  opacity: isConnected ? 1 : 0.5,
                }}
              >
                Next: Pick Template <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pick Template */}
        {currentStep === 1 && (
          <div style={{ background: "white", padding: 32, borderRadius: 12, border: `1px solid rgba(11,26,51,0.1)` }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 900 }}>Pick a Template</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: C.steel }}>
              Choose a pre-built scenario. Each template is optimized for a specific use case.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  style={{
                    padding: 20, border: `2px solid ${selectedTemplate === template.id ? C.purple : "rgba(11,26,51,0.1)"}`,
                    borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                    background: selectedTemplate === template.id ? "rgba(159,114,255,0.05)" : "white",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{template.icon}</div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>{template.name}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: C.steel, lineHeight: 1.4 }}>
                    {template.description}
                  </p>
                  <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, textTransform: "uppercase" }}>
                    {template.category}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "space-between" }}>
              <button
                onClick={() => setCurrentStep(0)}
                style={{
                  padding: "12px 24px", background: "none", border: `1px solid rgba(11,26,51,0.2)`,
                  borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.steel,
                }}
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!selectedTemplate}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "12px 24px",
                  background: C.ocean, color: "white", border: "none", borderRadius: 6,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  opacity: selectedTemplate ? 1 : 0.5,
                }}
              >
                Next: Configure <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configure */}
        {currentStep === 2 && selectedTemplateData && (
          <div style={{ background: "white", padding: 32, borderRadius: 12, border: `1px solid rgba(11,26,51,0.1)` }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 900 }}>Configure {selectedTemplateData.name}</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: C.steel }}>
              Set your payment parameters. The AI will use these as guidelines for decision-making.
            </p>
            
            <div style={{ display: "grid", gap: 16 }}>
              {selectedTemplateData.formFields.map((field: any) => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
                    {field.label} {field.required && <span style={{ color: C.coral }}>*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{
                        width: "100%", padding: "10px 12px", border: `1px solid rgba(11,26,51,0.2)`,
                        borderRadius: 6, fontSize: 12, boxSizing: "border-box",
                      }}
                    >
                      <option value="">{field.placeholder}</option>
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value })}
                      style={{
                        width: "100%", padding: "10px 12px", border: `1px solid rgba(11,26,51,0.2)`,
                        borderRadius: 6, fontSize: 12, boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: 16, background: "rgba(159,114,255,0.05)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 8 }}>Examples:</div>
              {selectedTemplateData.examples.map((example: string, i: number) => (
                <div key={i} style={{ fontSize: 11, color: C.steel, marginBottom: 4 }}>• {example}</div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "space-between" }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: "12px 24px", background: "none", border: `1px solid rgba(11,26,51,0.2)`,
                  borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.steel,
                }}
              >
                Back
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={loading || Object.keys(formData).length === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "12px 24px",
                  background: C.mint, color: "white", border: "none", borderRadius: 6,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  opacity: (loading || Object.keys(formData).length === 0) ? 0.5 : 1,
                }}
              >
                {loading ? "Creating..." : "Activate Agent"} <Zap size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {currentStep === 3 && (
          <div style={{ background: "white", padding: 32, borderRadius: 12, border: `1px solid rgba(11,26,51,0.1)`, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 900 }}>Agent Activated!</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: C.steel }}>
              Your AI agent is now monitoring signals and ready to make payments automatically.
            </p>
            {/* Fund Warning */}
            <div style={{ padding: 16, background: "rgba(242,164,58,0.1)", borderRadius: 8, marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 8 }}>⚠️ Agent Needs USDC</div>
              <div style={{ fontSize: 12, color: C.steel, lineHeight: 1.5 }}>
                Your agent has 0 USDC. It cannot make payments until you fund it. 
                Send USDC on Arc Testnet to your agent wallet: 
                <code style={{ display: "block", marginTop: 8, padding: 8, background: "rgba(11,26,51,0.05)", borderRadius: 4, fontSize: 11, wordBreak: "break-all" }}>
                  {myAgent?.walletAddress || "loading..."}
                </code>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a
                href="/dashboard"
                style={{
                  display: "inline-block", padding: "12px 24px", background: C.ocean, color: "white",
                  textDecoration: "none", borderRadius: 6, fontSize: 12, fontWeight: 700,
                }}
              >
                View Dashboard
              </a>
              <button
                onClick={() => {
                  setCurrentStep(0);
                  setSelectedTemplate(null);
                  setFormData({});
                }}
                style={{
                  padding: "12px 24px", background: "none", border: `1px solid rgba(11,26,51,0.2)`,
                  borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.steel,
                }}
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}