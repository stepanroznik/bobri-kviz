<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { loadQuiz } from './api';
import AdminView from './components/AdminView.vue';
import ProjectorView from './components/ProjectorView.vue';
import { normalizeQuiz } from './quiz';
import type { Quiz } from './types';

const adminKey = new URLSearchParams(window.location.search).get('admin');
const quiz = ref<Quiz | null>(null);
const loadingError = ref('');
const adminDirty = ref(false);
const isAdmin = computed(() => Boolean(adminKey));

function warnBeforeLeaving(event: BeforeUnloadEvent): void {
  if (!adminDirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onMounted(async () => {
  try {
    quiz.value = normalizeQuiz(await loadQuiz(adminKey));
    if (isAdmin.value) window.addEventListener('beforeunload', warnBeforeLeaving);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadingError.value = isAdmin.value
      ? `Admin se nepodařilo otevřít.\n\n${message}\n\nZkontroluj hodnotu ?admin=… a proměnnou ADMIN_KEY v Cloudflare.`
      : `Kvíz se nepodařilo načíst: ${message}`;
  }
});

onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeLeaving));
</script>

<template>
  <div v-if="loadingError" class="error-screen">
    <div style="white-space: pre-line">{{ loadingError }}</div>
  </div>
  <AdminView
    v-else-if="quiz && isAdmin"
    :quiz="quiz"
    :admin-key="adminKey!"
    @dirty="adminDirty = $event"
  />
  <ProjectorView v-else-if="quiz" :quiz="quiz" />
</template>
