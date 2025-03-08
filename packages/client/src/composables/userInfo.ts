import { useStorage } from '@vueuse/core';
import type { UserInfo } from '@8427003/waline-api';
import type { Ref } from 'vue';

export const USER_KEY = 'WALINE_USER';

export type UserInfoRef = Ref<UserInfo | Record<string, never>>;

function getStorage() {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('WALINE_USER') ? window.sessionStorage : window.localStorage;
  }
  return;
}
const userInfoStorage = useStorage<UserInfo | Record<string, never>>(
  USER_KEY,
  {},
  getStorage(),
);

export const useUserInfo = (): UserInfoRef => userInfoStorage;
