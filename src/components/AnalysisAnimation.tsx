import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app';
import './AnalysisAnimation.css';

interface AnimationStep {
  label: string;
  duration: number;
  completed: boolean;
}

const ANIMATION_STEPS: AnimationStep[] = [
  { label: 'Reading audio', duration: 0.8, completed: false },
  { label: 'Locking the beat grid', duration: 1.0, completed: false },
  { label: 'Detecting key', duration: 0.7, completed: false },
  { label: 'Mapping structure', duration: 1.2, completed: false },
  { label: 'Measuring energy', duration: 1.0, completed: false },
  { label: 'Separating stems', duration: 1.6, completed: false },
  { label: 'Transcribing notes', duration: 1.2, completed: false },
  { label: 'Tagging ear candy', duration: 0.6, completed: false },
];

interface AnalysisAnimationProps {
  onComplete: () => void;
}

export function AnalysisAnimation({ onComplete }: AnalysisAnimationProps) {
  const [steps, setSteps] = useState<AnimationStep[]>(ANIMATION_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isSkipped, setIsSkipped] = useState(false);

  const totalDuration = ANIMATION_STEPS.reduce((sum, s) => sum + s.duration, 0);
  const completedDuration = ANIMATION_STEPS.slice(0, currentStepIndex)
    .reduce((sum, s) => sum + s.duration, 0);
  const overallProgress = ((completedDuration + progress) / totalDuration) * 100;

  useEffect(() => {
    if (isSkipped) {
      onComplete();
      return;
    }

    if (currentStepIndex >= steps.length) {
      onComplete();
      return;
    }

    const currentStep = steps[currentStepIndex];
    const startTime = Date.now();
    const stepDurationMs = currentStep.duration * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const stepProgress = Math.min(elapsed / stepDurationMs, 1);
      setProgress(stepProgress);

      if (stepProgress >= 1) {
        const newSteps = [...steps];
        newSteps[currentStepIndex].completed = true;
        setSteps(newSteps);
        setCurrentStepIndex(currentStepIndex + 1);
        setProgress(0);
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [currentStepIndex, isSkipped, steps, onComplete]);

  const handleSkip = () => {
    setIsSkipped(true);
  };

  return (
    <div className="analysis-animation-overlay" onClick={handleSkip}>
      <div className="analysis-animation">
        <div className="animation-steps">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`step ${step.completed ? 'completed' : index === currentStepIndex ? 'active' : ''}`}
            >
              <span className="step-label">{step.label}</span>
              {step.completed && <span className="step-check">✓</span>}
            </div>
          ))}
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${overallProgress}%` }} />
        </div>

        <div className="animation-hint">
          Click or press Enter to skip
        </div>
      </div>
    </div>
  );
}
