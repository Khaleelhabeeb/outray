import { X, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "error" | "info" | "success";
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = "error",
}: AlertModalProps) {
  const colors = {
    error: "text-red-500 bg-red-500/10 border-red-500/20",
    info: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    success: "text-green-500 bg-green-500/10 border-green-500/20",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors[type]}`}
                    >
                      <AlertCircle
                        className={`w-5 h-5 ${colors[type].split(" ")[0]}`}
                      />
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      {title}
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {message}
                </p>

                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
