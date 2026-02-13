import React from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';

interface StatusTimelineProps {
  steps: string[];
  currentStep: string;
}

const StatusTimeline: React.FC<StatusTimelineProps> = ({ steps, currentStep }) => {
  const currentIdx = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center min-w-0">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  isCompleted && 'bg-green-500 border-green-500 text-white',
                  isCurrent && 'bg-white border-white text-black animate-pulse',
                  !isCompleted && !isCurrent && 'bg-slate-800 border-slate-600 text-slate-500'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={clsx(
                  'text-[10px] mt-1.5 text-center leading-tight max-w-[80px] truncate',
                  isCurrent ? 'text-primary-400 font-semibold' : isCompleted ? 'text-green-400' : 'text-slate-500'
                )}
              >
                {step.replace(/_/g, ' ')}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-1 mt-[-16px]',
                  idx < currentIdx ? 'bg-green-500' : 'bg-slate-700'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StatusTimeline;
