import { create } from 'zustand';
import { api, tokens } from '@/lib/api';

export interface Role {
  slug: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  document: string | null;
  type: 'INTERNAL' | 'CLIENT' | 'PARTNER';
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'INVITED';
  jobTitle: string | null;
  department: string | null;
  lastLoginAt: string | null;
  roles: Role[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  async signIn(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    tokens.save(data.accessToken, data.refreshToken);
    set({ user: data.user });
  },

  async signOut() {
    try {
      await api.post('/auth/logout', { refreshToken: tokens.refresh });
    } catch {
      // Sessão já pode ter expirado no servidor — seguimos limpando localmente.
    }
    tokens.clear();
    set({ user: null });
  },

  async loadSession() {
    if (!tokens.access) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, loading: false });
    } catch {
      tokens.clear();
      set({ user: null, loading: false });
    }
  },

  /** Verdadeiro se o usuário tem **todas** as permissões informadas. */
  can(...permissions) {
    const user = get().user;
    if (!user) return false;
    return permissions.every((p) => user.permissions.includes(p));
  },
}));
