<script setup lang="ts">
import { getArticleCounter, updateArticleCounter } from '@8427003/waline-api';
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';

import { LoadingIcon } from './Icons.js';
import { useReactionStorage } from '../composables/index.js';
import type { WalineReactionLocale } from '../typings/index.js';
import { configKey } from '../config/index.js';
import { watchImmediate } from '@vueuse/core';

interface ReactionItem {
  icon: string;
  desc: string;
  active?: boolean;
}

const reactionStorage = useReactionStorage();
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const config = inject(configKey)!;

const votingIndex = ref(-1);
const voteNumbers = ref<number[]>([]);

const locale = computed(() => config.value.locale);
const reaction = computed(() => {
  const { reaction } = config.value;

  return reaction?.length ? reaction : null;
});

const reactionsInfo = computed<ReactionItem[] | null>(() => {
  const { path } = config.value;

  return (
    reaction.value?.map((icon, index) => ({
      icon,
      desc: locale.value[`reaction${index}` as keyof WalineReactionLocale],
      active: reactionStorage.value[path] === index,
    })) ?? null
  );
});

let abort: (() => void) | undefined;

const fetchReaction = async (): Promise<void> => {
  const { serverURL, lang, path } = config.value;

  if (!reaction.value) return;

  const controller = new AbortController();

  abort = controller.abort.bind(controller);

  const [reactionData] = (await getArticleCounter({
    serverURL,
    lang,
    paths: [path],
    type: reaction.value.map((_, index) => `reaction${index}`),
    signal: controller.signal,
  })) as Record<string, number>[];

  voteNumbers.value = reaction.value.map(
    (_, index) => reactionData[`reaction${index}`],
  );
};

const vote = async (index: number): Promise<void> => {
  // we should ensure that only one vote request is sent at a time
  if (votingIndex.value !== -1) return;

  const { serverURL, lang, path } = config.value;
  const currentVoteItemIndex = reactionStorage.value[path];

  // mark voting status
  votingIndex.value = index;

  // if user already vote current article, decrease the voted item number
  if (currentVoteItemIndex !== undefined) {
    await updateArticleCounter({
      serverURL,
      lang,
      path,
      type: `reaction${currentVoteItemIndex}`,
      action: 'desc',
    });

    voteNumbers.value[currentVoteItemIndex] = Math.max(
      voteNumbers.value[currentVoteItemIndex] - 1,
      0,
    );
  }

  // increase voting number if current reaction item is not been voted
  if (currentVoteItemIndex !== index) {
    await updateArticleCounter({
      serverURL,
      lang,
      path,
      type: `reaction${index}`,
    });
    voteNumbers.value[index] = (voteNumbers.value[index] || 0) + 1;
  }

  // update vote info in local storage
  if (currentVoteItemIndex === index) delete reactionStorage.value[path];
  else reactionStorage.value[path] = index;

  // voting is completed
  votingIndex.value = -1;
};

onMounted(() => {
  watchImmediate(
    () => [config.value.serverURL, config.value.path],
    () => fetchReaction(),
  );
});

onUnmounted(() => {
  abort?.();
});
</script>

<template>
  <div v-if="reactionsInfo" class="wl-reaction">
    <ul class="wl-reaction-list">
      <li
        v-for="({ active, icon, desc }, index) in reactionsInfo"
        :key="index"
        class="wl-reaction-item"
        :class="{ active }"
        @click="vote(index)"
      >
        <div class="wl-reaction-img">
          <img :src="icon" :alt="desc" />

          <LoadingIcon
            v-if="votingIndex === index"
            class="wl-reaction-loading"
          />

          <div
            v-else
            class="wl-reaction-votes"
            v-text="voteNumbers[index] || 0"
          />
        </div>

        <div class="wl-reaction-text" v-text="desc" />
      </li>
    </ul>
  </div>
</template>
