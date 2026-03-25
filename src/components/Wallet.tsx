import React, { useEffect, type JSX } from "react";
import {
  FaWallet,
  FaMoneyBill,
  FaPiggyBank,
  FaCoins,
  FaBolt,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useWalletStore } from "../store/walletStore";
import { TransactionHistory } from "./TransactionHistory";

interface WalletProps {
  username?: string;
  className?: string;
}

interface WalletTileProps {
  label: string;
  value?: string;
  icon?: JSX.Element;
  iconBgClass?: string;
  iconTextClass?: string;
  valueClass?: string;
}

export const Wallet: React.FC<WalletProps> = ({ username, className = "" }) => {
  const { walletData, fetchWalletData, isLoading, error } = useWalletStore();

  useEffect(() => {
    if (username) fetchWalletData(username);
  }, [username, fetchWalletData]);

  const WalletTile: React.FC<WalletTileProps> = ({
    label,
    value,
    icon,
    iconBgClass = "bg-blue-500/15",
    iconTextClass = "text-blue-400",
    valueClass = "text-gray-200",
  }) => (
    <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-800 border border-gray-700 mb-2.5 transition-all duration-200 hover:bg-gray-750 hover:border-gray-600">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`p-2 rounded-full flex items-center justify-center ${iconBgClass} ${iconTextClass}`}>
            {icon}
          </div>
        )}
        <span className="font-semibold text-sm text-gray-300">{label}</span>
      </div>
      <span className={`font-medium text-sm ${valueClass}`}>{value ?? "-"}</span>
    </div>
  );

  return (
    <div className={`p-4 transition-all duration-300 ${className}`}>
      <div className="max-w-md mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col items-center p-5 mb-5 rounded-xl bg-gray-800 border border-gray-700">
          {username && (
            <img
              src={`https://images.hive.blog/u/${username}/avatar`}
              alt={`${username} avatar`}
              className="w-16 h-16 rounded-full border-3 border-blue-500/30 mb-2.5 transition-transform hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${username}&background=random`;
              }}
            />
          )}
          <div className="text-base font-bold text-white">{username}</div>
          <div className="text-xs text-gray-400">Hive Wallet Overview</div>
        </div>

        {/* Estimated Value Card */}
        <div className="text-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-5 mb-5 transition-all duration-300 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/10">
          <div className="text-xs font-semibold text-blue-100/80">Estimated Value</div>
          <div className="text-2xl font-bold mt-1.5 text-white">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-lg">Loading...</span>
              </div>
            ) : (
              walletData?.estimated_value ?? "-"
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-4 text-sm">
            <FaExclamationTriangle className="mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <WalletTile
          label="Balance"
          value={walletData?.balance}
          icon={<FaWallet />}
          iconBgClass="bg-blue-500/15"
          iconTextClass="text-blue-400"
          valueClass="text-blue-300"
        />
        <WalletTile
          label="HBD Balance"
          value={walletData?.hbd_balance}
          icon={<FaMoneyBill />}
          iconBgClass="bg-emerald-500/15"
          iconTextClass="text-emerald-400"
          valueClass="text-emerald-300"
        />
        <WalletTile
          label="Savings Balance"
          value={walletData?.savings_balance}
          icon={<FaPiggyBank />}
          iconBgClass="bg-amber-500/15"
          iconTextClass="text-amber-400"
          valueClass="text-amber-300"
        />
        <WalletTile
          label="Savings HBD"
          value={walletData?.savings_hbd_balance}
          icon={<FaCoins />}
          iconBgClass="bg-purple-500/15"
          iconTextClass="text-purple-400"
          valueClass="text-purple-300"
        />
        <WalletTile
          label="Hive Power"
          value={walletData?.hive_power}
          icon={<FaBolt />}
          iconBgClass="bg-orange-500/15"
          iconTextClass="text-orange-400"
          valueClass="text-orange-300"
        />

        {/* Transaction History */}
        <TransactionHistory username={username} />
      </div>
    </div>
  );
};

export default Wallet;
