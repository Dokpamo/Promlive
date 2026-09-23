import {z} from 'zod';
import type {SettingsStore} from '../../ports/settings';

export const userProfileKey = 'user:profile:v1';
export const avatarImageSchema = z.string().max(2_000_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);
const profileSchema = z.object({name: z.string().trim().min(1).max(24), image: avatarImageSchema.nullable()});
export type UserProfile = z.infer<typeof profileSchema>;
export const defaultUserProfile: UserProfile = {name: '사용자', image: null};

export function restoreUserProfile(raw: string | undefined): UserProfile {
  if (!raw) return {...defaultUserProfile};
  try {
    const saved = JSON.parse(raw);
    // A missing/old image must not discard the saved name.
    const name = profileSchema.shape.name.safeParse(saved?.name);
    const image = avatarImageSchema.safeParse(saved?.image);
    return {name: name.success ? name.data : defaultUserProfile.name, image: image.success ? image.data : null};
  } catch {return {...defaultUserProfile};}
}

/** One persisted profile feeds both settings and the card-list account row. */
export class UserProfilePreferences {
  private state = {value: defaultUserProfile, ready: false, error: ''};
  private listeners = new Set<() => void>();
  private loading: Promise<void> | undefined;
  private saving: Promise<void> = Promise.resolve();
  constructor(private readonly store: SettingsStore) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private emit() {for (const listener of this.listeners) listener();}
  load = () => this.loading ??= this.store.getSetting(userProfileKey).then(raw => {
    this.state = {value: restoreUserProfile(raw), ready: true, error: ''}; this.emit();
  }).catch(() => {
    this.loading = undefined;
    this.state = {...this.state, error: '프로필을 불러오지 못했어요. 다시 시도해 주세요.'}; this.emit();
  });
  save = (profile: UserProfile): Promise<void> => this.update(profileSchema.parse(profile));
  /** Merge at write time so photo selection and typing never restore each other's old value. */
  update = (patch: Partial<UserProfile>): Promise<void> => {
    const changes = profileSchema.partial().parse(patch);
    const next = this.saving.catch(() => {}).then(async () => {
      await this.load();
      if (!this.state.ready) throw new Error(this.state.error);
      const value = profileSchema.parse({...this.state.value, ...changes});
      if (value.name === this.state.value.name && value.image === this.state.value.image) return;
      await this.store.setSetting(userProfileKey, JSON.stringify({version: 1, ...value}));
      this.state = {value, ready: true, error: ''}; this.emit();
    });
    this.saving = next;
    return next;
  };
}
