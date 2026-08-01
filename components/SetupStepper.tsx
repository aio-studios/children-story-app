import { ReactNode } from "react";

type Step = {
  label: string;
  icon: string;
  content: ReactNode;
  isReady: boolean;
};

type SetupStepperProps = {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onBackFromFirstStep: () => void;
  onFinish: () => void;
};

export function SetupStepper({ steps, currentStep, onStepChange, onBackFromFirstStep, onFinish }: SetupStepperProps) {
  const isLastStep = currentStep === steps.length - 1;
  const canAdvance = steps[currentStep].isReady;

  function handleBack() {
    if (currentStep === 0) {
      onBackFromFirstStep();
    } else {
      onStepChange(currentStep - 1);
    }
  }

  function handleNext() {
    if (isLastStep) {
      onFinish();
    } else {
      onStepChange(currentStep + 1);
    }
  }

  return (
    <main className="sk-setup-frame">
      <div className="sk-stepper-dots">
        {steps.map((step, index) => (
          <div key={step.label} className="sk-dot-col">
            {index < steps.length - 1 && (
              <div className={`sk-dot-connector ${index < currentStep ? "sk-dot-connector-done" : ""}`} />
            )}
            <div
              className={`sk-dot ${
                index === currentStep ? "sk-dot-current" : index < currentStep ? "sk-dot-done" : ""
              }`}
            >
              {index < currentStep ? "✓" : step.icon}
            </div>
          </div>
        ))}
      </div>
      <div className="sk-stepper-labels">
        {steps.map((step, index) => (
          <span key={step.label} className={index === currentStep ? "sk-stepper-label-current" : ""}>
            {step.label}
          </span>
        ))}
      </div>

      <h1 className="sk-step-heading">{steps[currentStep].label}</h1>
      {steps[currentStep].content}

      <div className="sk-stepper-nav">
        <button type="button" onClick={handleBack} className="sk-nav-btn">
          ← Back
        </button>
        <span className="sk-step-count">
          Step {currentStep + 1} of {steps.length}
        </span>
        <button type="button" onClick={handleNext} disabled={!canAdvance} className="sk-nav-btn sk-nav-btn-primary">
          {isLastStep ? "Create story" : "Next →"}
        </button>
      </div>
    </main>
  );
}
