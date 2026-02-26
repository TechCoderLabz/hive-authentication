import React, { useState } from 'react';
import { X, AlertTriangle, Flag } from 'lucide-react';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReport: (reason: string) => Promise<void>;
  reportType: 'user' | 'post';
  targetUsername: string;
  targetPermlink?: string;
}

const REPORT_REASONS = [
  'Spam',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous organizations',
  'Intellectual property violation',
  'Self-harm',
  'Non-consensual intimate images',
  'Doxxing',
  'Minor safety',
  'Other'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onReport,
  reportType,
  targetUsername,
  targetPermlink,
}) => {
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    
    setIsSubmitting(true);
    try {
      await onReport(selectedReason);
      onClose();
      // Reset state
      setStep('select');
      setSelectedReason('');
    } catch (error) {
      console.error('Report failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setStep('select');
    setSelectedReason('');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedReason('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-black/90 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col border border-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Flag className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-white">
                Report {reportType === 'user' ? 'User' : 'Post'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-slate-950 rounded transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div>
              <p className="text-sm text-gray-400 mb-4">
                Why are you reporting this {reportType}?
              </p>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleReasonSelect(reason)}
                    className="w-full text-left px-4 py-3 border border-gray-600 rounded-lg hover:bg-slate-950 transition-colors"
                  >
                    <span className="text-white">{reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <div className="flex items-start space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white mb-2">
                    Report Summary
                  </h4>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p><strong>Type:</strong> {reportType === 'user' ? 'User' : 'Post'}</p>
                    <p><strong>Target:</strong> @{targetUsername}</p>
                    {reportType === 'post' && targetPermlink && (
                      <p><strong>Post:</strong> {targetPermlink}</p>
                    )}
                    <p><strong>Reason:</strong> {selectedReason}</p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
                <p className="text-xs text-yellow-200">
                  Reports are reviewed by our moderation team. False reports may result in action against your account.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end space-x-3">
          {step === 'select' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-600 text-gray-300 bg-slate-950 rounded-lg hover:bg-black/60 transition-colors"
            >
              Cancel
            </button>
          )}
          
          {step === 'confirm' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 border border-gray-600 text-gray-300 bg-slate-950 rounded-lg hover:bg-black/60 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Reporting...' : 'Submit Report'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};