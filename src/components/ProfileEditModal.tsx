/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LoggedInUser } from '../types/auth';
import { useAuthStore } from '../store/authStore';
import EthereumIcon from '../assets/ethereum.svg';
import MetaMaskIcon from '../assets/metamask.svg';
import CoinbaseIcon from '../assets/coinbase.svg';
import TrustWalletIcon from '../assets/trustwallet.svg';
import PhantomIcon from '../assets/phantom.svg';
import RainbowIcon from '../assets/rainbow.svg';
import WalletConnectIcon from '../assets/walletconnect.svg';

export interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: LoggedInUser;
  onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
  theme?: 'light' | 'dark';
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
  theme: _theme = 'dark',
}) => {
  const { updateUserProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState<string>(user.displayName || '');
  const [photoURL, setPhotoURL] = useState<string>(user.photoURL || '');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'presets' | 'url' | 'upload'>('presets');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const addr = user.address || user.username;

  // Preset avatar generators
  const presetAvatars = [
    { label: 'Effigy Identicon', url: `https://effigy.im/a/${addr}.svg` },
    { label: 'Pixel Avatar', url: `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}&backgroundColor=0052ff,627eea,e31337` },
    { label: 'Bot Avatar', url: `https://api.dicebear.com/7.x/bottts/svg?seed=${addr}` },
    { label: 'Avataaars', url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${addr}` },
    { label: 'Shapes', url: `https://api.dicebear.com/7.x/shapes/svg?seed=${addr}` },
    { label: 'Robohash', url: `https://robohash.org/${addr}.png?set=set1&size=120x120` },
  ];

  const getProviderIcon = () => {
    const name = (user.web3WalletName || user.provider || '').toLowerCase();
    if (name.includes('metamask')) return MetaMaskIcon;
    if (name.includes('coinbase')) return CoinbaseIcon;
    if (name.includes('trust')) return TrustWalletIcon;
    if (name.includes('phantom')) return PhantomIcon;
    if (name.includes('rainbow')) return RainbowIcon;
    if (name.includes('walletconnect')) return WalletConnectIcon;
    return EthereumIcon;
  };

  const getProviderName = () => {
    return user.web3WalletName || (user.loginType === 'web3' ? 'Web3 Wallet' : user.provider);
  };

  const currentPreviewAvatar = photoURL || `https://effigy.im/a/${addr}.svg`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoURL(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanName = displayName.trim();
      const cleanPhoto = photoURL.trim();

      // 1. Update in local zustand store & encrypted localStorage
      updateUserProfile(user.username, {
        displayName: cleanName || undefined,
        photoURL: cleanPhoto || undefined,
      });

      // 2. Call optional backend sync callback
      if (onUpdateProfile) {
        await onUpdateProfile({
          username: user.username,
          displayName: cleanName || undefined,
          photoURL: cleanPhoto || undefined,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Failed to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-zinc-950/95 text-white rounded-3xl border border-zinc-800 shadow-[0_0_50px_rgba(227,19,55,0.15)] overflow-hidden flex flex-col p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <h3 className="font-bold text-lg text-white">Edit Profile</h3>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-zinc-800 cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 flex items-center gap-4 shadow-inner">
          <div className="relative shrink-0">
            <img
              src={currentPreviewAvatar}
              alt="Avatar Preview"
              className="w-14 h-14 rounded-full border-2 border-red-500/60 object-cover bg-zinc-900"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://effigy.im/a/${addr}.svg`;
              }}
            />
            <img
              src={getProviderIcon()}
              alt="Wallet Icon"
              className="w-5 h-5 absolute -bottom-0.5 -right-0.5 bg-zinc-950 rounded-full p-0.5 border border-zinc-700 shadow-md"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-base text-zinc-100 truncate">
                {displayName.trim() || (addr.startsWith('0x') ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr)}
              </p>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-950/80 border border-red-800/60 text-red-300 rounded-full">
                {getProviderName()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono truncate mt-0.5">
              {addr}
            </p>
          </div>
        </div>

        {/* Display Name Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Profile Name
          </label>
          <div className="relative">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              placeholder="e.g. CryptoSamurai, Lokesh"
              className="w-full bg-zinc-900/80 border border-zinc-700/80 hover:border-zinc-600 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
            />
            <span className="absolute right-3 top-2.5 text-[10px] text-zinc-500">
              {displayName.length}/30
            </span>
          </div>
        </div>

        {/* Avatar Selection Tabs */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Profile Avatar
            </label>
            <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === 'presets'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => setActiveTab('presets')}
              >
                Presets
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === 'url'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => setActiveTab('url')}
              >
                Image URL
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => setActiveTab('upload')}
              >
                Upload
              </button>
            </div>
          </div>

          {/* Preset Avatars Grid */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-6 gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              {presetAvatars.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  title={preset.label}
                  className={`relative p-1 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group ${
                    photoURL === preset.url
                      ? 'border-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(227,19,55,0.3)] scale-105'
                      : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                  onClick={() => setPhotoURL(preset.url)}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    className="w-full aspect-square rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://effigy.im/a/${addr}.svg`;
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Image URL Input */}
          {activeTab === 'url' && (
            <div className="space-y-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="flex-1 bg-zinc-900 border border-zinc-700/80 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500"
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => {
                    if (customUrlInput.trim()) {
                      setPhotoURL(customUrlInput.trim());
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* File Upload Button */}
          {activeTab === 'upload' && (
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/80 text-center space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-zinc-700 hover:border-red-500 bg-zinc-900 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <span>📁</span> Choose Image File (Max 2MB)
              </button>
              {photoURL && photoURL.startsWith('data:image') && (
                <p className="text-[11px] text-emerald-400">✓ Image loaded from local file</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            className={`flex-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white'
            }`}
            onClick={handleSave}
          >
            {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
