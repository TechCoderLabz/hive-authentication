// Components
export { AuthButton } from './components/AuthButton';
export { LoginDialog } from './components/LoginDialog';
export { SwitchUserModal } from './components/SwitchUserModal';
export { Web2LoginDialog } from './components/Web2LoginDialog';
export { Wallet } from './components/Wallet';
export { TransactionHistory } from './components/TransactionHistory';
export { VideoFeed } from './components/video/VideoFeed';
export { BottomToolbarWithSlider } from './components/BottomToolbarWithSlider';
export { HiveSignerCallback } from './components/HiveSignerCallback';

// Store and hooks
export { useAuthStore } from './store/authStore';
export { useProgrammaticAuth } from './hooks/useProgrammaticAuth';
export { ReportModal } from './components/ReportModal';

// Services
export { AuthService } from './services/authService';
export { ProgrammaticAuth } from './services/programmaticAuth';

// Hive API node configuration — let the host app (e.g. HiveSuite) push
// its user-selected node into the package so every internal dhive
// Client and the Aioha-level setApi propagation use it instead of the
// hard-coded default (api.hive.blog / Aioha's techcoderx.com).
export {
  getHiveAuthApiNode,
  setHiveAuthApiNode,
  subscribeHiveAuthApiNode,
} from './config/hiveApi';

// Types
export type {
  HiveAuthResult,
  ServerAuthResponse,
  LoggedInUser,
  AuthStore,
  SwitchUserModalProps,
  LoginDialogProps,
  Web2Config,
  Web2AuthResult,
} from './types/auth';
