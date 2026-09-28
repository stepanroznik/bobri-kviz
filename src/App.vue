<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { loadQuiz } from './api';
import AdminView from './components/AdminView.vue';
import ProjectorView from './components/ProjectorView.vue';
import { preloadQuizMedia, type PreloadProgress } from './preload';
import { normalizeQuiz } from './quiz';
import type { Quiz } from './types';

const adminKey = new URLSearchParams(window.location.search).get('admin');
const quiz = ref<Quiz | null>(null);
const loadingError = ref('');
const adminDirty = ref(false);
const preloading = ref(true);
const preloadProgress = ref<PreloadProgress>({ total: 0, completed: 0, failed: 0, downloadedBytes: 0, totalBytes: 0 });
const assetUrls = ref(new Map<string, string>());
const isAdmin = computed(() => Boolean(adminKey));
const remainingAssets = computed(() => Math.max(0, preloadProgress.value.total - preloadProgress.value.completed));

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
  if (!adminDirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

onMounted(async () => {
  try {
    quiz.value = normalizeQuiz(await loadQuiz(adminKey));
    if (isAdmin.value) window.addEventListener('beforeunload', warnBeforeLeaving);
    const preload = await preloadQuizMedia(quiz.value, (progress) => { preloadProgress.value = progress; });
    assetUrls.value = preload.assetUrls;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadingError.value = isAdmin.value
      ? `Admin se nepodařilo otevřít.\n\n${message}\n\nZkontroluj hodnotu ?admin=… a proměnnou ADMIN_KEY v Cloudflare.`
      : `Kvíz se nepodařilo načíst: ${message}`;
  } finally {
    preloading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeLeaving);
  assetUrls.value.forEach((url) => URL.revokeObjectURL(url));
});
</script>

<template>
  <div v-if="loadingError" class="error-screen"><div style="white-space: pre-line">{{ loadingError }}</div></div>
  <div v-else-if="preloading" class="asset-loader" aria-live="polite">
    <img src="/logo.svg" alt="" class="asset-loader__logo" />
    <div class="asset-loader__eyebrow">{{ isAdmin ? 'Připravuji administraci' : 'Připravuji kvíz' }}</div>
    <h1>Stahuji obrázky a zvuk</h1>
    <p v-if="preloadProgress.total">{{ preloadProgress.completed }} / {{ preloadProgress.total }} médií hotovo · zbývá {{ remainingAssets }}</p>
    <p v-else>Načítám obsah kvízu…</p>
    <div class="asset-loader__track"><div :style="{ width: preloadProgress.total ? `${(preloadProgress.completed / preloadProgress.total) * 100}%` : '8%' }" /></div>
    <p v-if="preloadProgress.totalBytes" class="tiny">{{ formatBytes(preloadProgress.downloadedBytes) }} z {{ formatBytes(preloadProgress.totalBytes) }}</p>
    <p v-if="preloadProgress.failed" class="asset-loader__warning">{{ preloadProgress.failed }} médií se nepodařilo uložit pro offline použití.</p>
  </div>
  <AdminView v-else-if="quiz && isAdmin" :quiz="quiz" :admin-key="adminKey!" @dirty="adminDirty = $event" />
  <ProjectorView v-else-if="quiz" :quiz="quiz" :asset-urls="assetUrls" />
</template>
