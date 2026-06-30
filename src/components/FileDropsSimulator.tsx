import React, { useState } from "react";
import { Plus, Terminal, ClipboardList, CheckCircle, Code, HelpCircle } from "lucide-react";

interface Template {
  name: string;
  filename: string;
  content: string;
  categoryHint: string;
}

const TEMPLATES: Template[] = [
  {
    name: "AWS Server Invoice",
    filename: "invoice_aws_amazon_340.txt",
    categoryHint: "Finance",
    content: `Amazon Web Services (AWS) Billing Invoice
Invoice ID: INV-9841203-2026
Account Number: ACCT-9381-1240-55
Issue Date: June 28, 2026

Summary of Charges:
- Elastic Compute Cloud (EC2) instances: $214.50
- Simple Storage Service (S3) standard buckets: $42.10
- Relational Database Service (RDS) multi-AZ: $184.00
- Virtual Private Cloud (VPC) ingress/egress bandwidth: $15.40

TOTAL DUE ON RECEIPT: $456.00 (charged to Visa ending in 4059).
Payments will be auto-processed within 2 business days. Thank you for using AWS.`
  },
  {
    name: "Python neural_net.py",
    filename: "neural_net.py",
    categoryHint: "Code",
    content: `import torch
import torch.nn as nn
import torch.optim as optim

class SimpleClassifier(nn.Module):
    """A standard multi-layer perceptron for digit classification."""
    def __init__(self, input_size=784, hidden_size=128, num_classes=10):
        super(SimpleClassifier, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)
        
    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out

if __name__ == "__main__":
    model = SimpleClassifier()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    print("Model initialized and optimizer set. Ready for offline training logs.")`
  },
  {
    name: "Q4 Marketing Strategy",
    filename: "marketing_strategy_q4.md",
    categoryHint: "Work",
    content: `# Q4 Marketing & Growth Strategy Plan
Last Updated: June 2026
Goal: Drive 25% increase in user signups via organic search optimization and technical newsletters.

## Key Channels & Tactics
1. **Developer Newsletter Sponsoring**: Partner with technical publishers to place banner newsletters regarding local AI tools.
2. **Technical SEO Improvements**: Optimize documentation pages for words like "local AI file watchdog", "offline SQLite indexing".
3. **Interactive Demos**: Build playground setups directly inside browser views.

## Budget Allocation
- Newsletter partnerships: $12,000
- Content drafting / professional writing: $4,500
- Technical SEO tools and audit subscriptions: $1,500
Total Allocated: $18,000`
  },
  {
    name: "Secret Family Recipe",
    filename: "grandma_marinara_secret.txt",
    categoryHint: "Personal",
    content: `GRANDMA'S SECRET SUNDAY MARINARA SAUCE
From the personal culinary log of Maria Rossi, passed down with love.

Ingredients:
- 3 cans of high-quality San Marzano whole peeled tomatoes (crush by hand)
- 4 cloves of fresh garlic, finely minced (never use powder!)
- 1/4 cup of cold-pressed extra virgin olive oil
- 10 fresh sweet basil leaves, hand-torn (add at the very end)
- 1 tsp of sea salt, black pepper, and a tiny pinch of red chili flakes

Preparation Instructions:
1. Warm the olive oil in a deep heavy saucepan over medium-low heat. Add garlic and stir gently until aromatic.
2. Carefully pour in the crushed tomatoes. Bring to a slow, lazy simmer.
3. Cook uncovered for 45 minutes, stirring occasionally.
4. Stir in torn basil leaves, season with salt, and serve over fresh spaghetti.`
  },
  {
    name: "Astrophysics Lecture Notes",
    filename: "astrophysics_notes_gravity.md",
    categoryHint: "Education",
    content: `# Astrophysics 301: Gravitational Orbits & Relativity
Lecture Date: June 15, 2026
Instructor: Dr. Alan Stern

## Core Concepts Covered
- **Keplerian Laws of Planetary Motion**: Explains elliptical orbits, sweeping equal areas in equal times, and orbital periods.
- **Escape Velocity Formula**: v_e = sqrt(2GM / R). Calculated gravity escapes for Earth (11.2 km/s).
- **Introduction to Gravitational Lensing**: Discusses how massive clusters warp spacetime and act as cosmic telescopes.

## Homework Assignment
- Complete Problems 4.1 to 4.5 in Chapter 8. Due next Wednesday before lab.`
  }
];

interface Props {
  onDropFile: (filename: string, content: string) => Promise<any>;
}

export default function FileDropsSimulator({ onDropFile }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<number>(0);
  const [customFilename, setCustomFilename] = useState<string>("");
  const [customContent, setCustomContent] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleTriggerDrop = async () => {
    setIsSubmitting(true);
    setSuccess(false);

    let finalFilename = "";
    let finalContent = "";

    if (isCustomMode) {
      finalFilename = customFilename.trim() || "unnamed_document.txt";
      finalContent = customContent.trim() || "Simulated text content.";
    } else {
      const template = TEMPLATES[selectedTemplate];
      finalFilename = template.filename;
      finalContent = template.content;
    }

    try {
      await onDropFile(finalFilename, finalContent);
      setSuccess(true);
      
      // Clear custom input if in custom mode
      if (isCustomMode) {
        setCustomFilename("");
        setCustomContent("");
      }
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to drop simulated file:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-panel-dark border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col gap-4 font-sans h-full">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sky-accent/10 flex items-center justify-center text-sky-accent">
          <Plus className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Simulate Watchdog Ingestion</h3>
          <p className="text-[11px] text-slate-500">Drop a mock file to watch the pipeline trigger</p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-2 bg-bg-dark p-1 rounded-lg shrink-0 text-xs border border-white/5">
        <button
          onClick={() => setIsCustomMode(false)}
          className={`py-1.5 rounded-md font-medium transition-all ${
            !isCustomMode ? "bg-[#1c1c1f] text-white shadow border border-white/5" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Use Template Document
        </button>
        <button
          onClick={() => setIsCustomMode(true)}
          className={`py-1.5 rounded-md font-medium transition-all ${
            isCustomMode ? "bg-[#1c1c1f] text-white shadow border border-white/5" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Create Custom File
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {!isCustomMode ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Sample Template</label>
              <div className="grid grid-cols-1 gap-1.5">
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={tpl.name}
                    onClick={() => {
                      setSelectedTemplate(i);
                      setSuccess(false);
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      selectedTemplate === i
                        ? "bg-sky-accent/10 border-sky-accent/40 text-sky-200 shadow shadow-sky-500/5"
                        : "bg-[#1c1c1f]/40 border-white/5 text-slate-400 hover:border-white/10 hover:bg-[#1c1c1f]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {tpl.categoryHint === "Code" ? (
                        <Code className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <ClipboardList className="w-4 h-4 text-sky-500 shrink-0" />
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-200 truncate">{tpl.name}</p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">{tpl.filename}</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-bg-dark border border-white/5 text-slate-400 shrink-0">
                      {tpl.categoryHint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Content Preview Box */}
            <div className="bg-bg-dark border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Document Preview</span>
              <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-36 line-clamp-5 leading-relaxed">
                {TEMPLATES[selectedTemplate].content}
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filename (with extension)</label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="e.g., meeting_notes_june.md, code_test.py"
                className="w-full bg-input-dark border border-white/5 focus:border-sky-accent/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">File Raw Content / Text</label>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                placeholder="Paste some rich paragraphs or notes here..."
                rows={6}
                className="w-full bg-input-dark border border-white/5 focus:border-sky-accent/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors resize-none font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="shrink-0 flex flex-col gap-2">
        <button
          onClick={handleTriggerDrop}
          disabled={isSubmitting || (isCustomMode && (!customFilename || !customContent))}
          className={`w-full py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-lg ${
            isSubmitting || (isCustomMode && (!customFilename || !customContent))
              ? "bg-[#1c1c1f] text-slate-600 border border-white/5 cursor-not-allowed shadow-none"
              : "bg-white text-slate-900 hover:bg-slate-200 active:scale-98 shadow-sky-500/5"
          }`}
        >
          {isSubmitting ? (
            <>
              <Terminal className="w-4.5 h-4.5 animate-spin" />
              <span>Simulating Drop...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Drop File in Watch Folder</span>
            </>
          )}
        </button>

        {/* Success toast inside card */}
        {success && (
          <div className="flex items-center gap-2 p-2 bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 rounded-xl text-[11px] justify-center animate-fade-in font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Watchdog triggered! See pending analysis on sidebar/grid.</span>
          </div>
        )}
      </div>
    </div>
  );
}
