import React, { useEffect } from "react";
import { FaArrowUp, FaArrowDown, FaExclamationTriangle } from "react-icons/fa";
import { useWalletStore } from "../store/walletStore";
import type { Transaction } from "../types/wallet";

interface TransactionHistoryProps {
  username?: string;
  className?: string;
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp + "Z");
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 30) {
    return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

const TransactionRow: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const isSent = tx.type === "sent";
  const otherUser = isSent ? tx.to : tx.from;

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-lg bg-gray-800 border border-gray-700 mb-2 transition-all duration-200 hover:bg-gray-750 hover:border-gray-600">
      {/* Direction icon */}
      <div
        className={`p-2 rounded-full flex items-center justify-center flex-shrink-0 ${
          isSent ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
        }`}
      >
        {isSent ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />}
      </div>

      {/* Avatar + user info */}
      <img
        src={`https://images.hive.blog/u/${otherUser}/avatar`}
        alt={otherUser}
        className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-gray-600"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${otherUser}&background=random&size=36`;
        }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-200 truncate">
            {otherUser}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {isSent ? "Sent" : "Received"} &middot; {formatTimeAgo(tx.timestamp)}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <div
          className={`text-sm font-bold ${
            isSent ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {isSent ? "-" : "+"}{tx.amount}
        </div>
      </div>
    </div>
  );
};

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  username,
  className = "",
}) => {
  const { transactions, fetchTransactions, isLoadingTransactions, transactionError } =
    useWalletStore();

  useEffect(() => {
    if (username) fetchTransactions(username);
  }, [username, fetchTransactions]);

  return (
    <div className={`mt-2 ${className}`}>
      <div className="max-w-md mx-auto">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-gray-300 tracking-wide uppercase">
            Transaction History
          </h3>
          {transactions.length > 0 && (
            <span className="text-xs text-gray-500">
              {transactions.length} transactions
            </span>
          )}
        </div>

        {/* Loading State */}
        {isLoadingTransactions && (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
              <span className="text-sm text-gray-400">Loading transactions...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {transactionError && (
          <div className="flex items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-4 text-sm">
            <FaExclamationTriangle className="mr-2 flex-shrink-0" />
            <span>{transactionError}</span>
          </div>
        )}

        {/* Transaction List */}
        {!isLoadingTransactions && !transactionError && transactions.length === 0 && (
          <div className="text-center p-8 rounded-lg bg-gray-800 border border-gray-700">
            <p className="text-sm text-gray-500">No transactions found</p>
          </div>
        )}

        {!isLoadingTransactions &&
          username &&
          transactions.map((tx) => (
            <TransactionRow key={tx.trx_id + tx.id} tx={tx} />
          ))}
      </div>
    </div>
  );
};

export default TransactionHistory;
