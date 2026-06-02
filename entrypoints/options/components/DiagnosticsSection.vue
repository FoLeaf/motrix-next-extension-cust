<script lang="ts" setup>
/**
 * @fileoverview Diagnostic log viewer section.
 *
 * Displays extension diagnostic events in a monospace log viewer
 * with level-colored badges, formatted timestamps, expandable context
 * details, and export/copy/clear actions. Uses Naive UI components
 * and Vue TransitionGroup for animated list operations.
 */
import { ref, computed, onUnmounted } from 'vue';
import { NButton, NIcon, NTag, NEmpty, NBadge } from 'naive-ui';
import { TrashOutline, DownloadOutline, RefreshOutline } from '@vicons/ionicons5';
import type { DiagnosticEvent } from '@/shared/types';

const props = defineProps<{
  events: DiagnosticEvent[];
}>();

const emit = defineEmits<{
  clear: [];
  export: [];
  resetSettings: [];
}>();

import { useI18n } from '@/shared/i18n/engine';

const { t: i18n } = useI18n();

const expandedId = ref<string | null>(null);
const confirmingReset = ref(false);
let resetConfirmTimer: ReturnType<typeof setTimeout> | null = null;

function clearResetConfirmTimer(): void {
  if (resetConfirmTimer) {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
  }
}

function handleResetClick(): void {
  if (confirmingReset.value) {
    clearResetConfirmTimer();
    confirmingReset.value = false;
    emit('resetSettings');
    return;
  }

  confirmingReset.value = true;
  resetConfirmTimer = setTimeout(() => {
    confirmingReset.value = false;
    resetConfirmTimer = null;
  }, 4000);
}

function toggleExpand(id: string): void {
  expandedId.value = expandedId.value === id ? null : id;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString();
  }
  return d.toLocaleString();
}

const reversed = computed(() => [...props.events].reverse());

const LEVEL_TYPE: Record<string, 'success' | 'warning' | 'error'> = {
  info: 'success',
  warn: 'warning',
  error: 'error',
};

onUnmounted(clearResetConfirmTimer);
</script>

<template>
  <div class="section">
    <div class="diag-actions">
      <NButton size="small" quaternary @click="emit('export')">
        <template #icon>
          <NIcon :size="14"><DownloadOutline /></NIcon>
        </template>
        {{ i18n('options_diagnostics_export', 'Export Report') }}
      </NButton>
      <NButton size="small" quaternary type="error" @click="emit('clear')">
        <template #icon>
          <NIcon :size="14"><TrashOutline /></NIcon>
        </template>
        {{ i18n('options_diagnostics_clear', 'Clear Log') }}
      </NButton>
      <NBadge
        v-if="events.length"
        :value="events.length"
        :max="999"
        type="info"
        style="margin-left: auto"
      />
    </div>

    <Transition name="fade" mode="out-in">
      <div v-if="events.length" key="log" class="diag-log">
        <div v-for="event in reversed" :key="event.id" class="diag-entry-wrapper">
          <div class="diag-entry" @click="event.context ? toggleExpand(event.id) : undefined">
            <span class="diag-entry__time">{{ formatTime(event.ts) }}</span>
            <NTag :type="LEVEL_TYPE[event.level] ?? 'default'" size="tiny" round>
              {{ event.level }}
            </NTag>
            <code class="diag-entry__code">{{ event.code }}</code>
            <span class="diag-entry__msg">{{ event.message }}</span>
            <span
              v-if="event.context"
              class="diag-entry__chevron"
              :class="{ expanded: expandedId === event.id }"
              >›</span
            >
          </div>
          <Transition name="context-expand">
            <div v-if="event.context && expandedId === event.id" class="diag-context">
              <div
                v-for="(value, key) in event.context"
                :key="String(key)"
                class="diag-context__row"
              >
                <span class="diag-context__key">{{ key }}</span>
                <span class="diag-context__value">{{ value }}</span>
              </div>
            </div>
          </Transition>
        </div>
      </div>
      <NEmpty
        v-else
        key="empty"
        size="small"
        :description="i18n('options_diagnostics_empty', 'No diagnostic events.')"
      />
    </Transition>

    <section class="factory-reset">
      <div>
        <h3 class="factory-reset__title">
          {{ i18n('options_factory_reset_title', 'Reset') }}
        </h3>
      </div>
      <NButton
        class="factory-reset__button"
        size="small"
        :type="confirmingReset ? 'error' : 'default'"
        @click="handleResetClick"
      >
        <template #icon>
          <NIcon :size="14"><RefreshOutline /></NIcon>
        </template>
        {{
          confirmingReset
            ? i18n('options_factory_reset_confirm', 'Click Again to Reset')
            : i18n('options_factory_reset_button', 'Reset Settings')
        }}
      </NButton>
    </section>
  </div>
</template>

<style scoped>
.diag-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.diag-log {
  max-height: min(400px, 50vh);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-surface-container-high);
  border-radius: 10px;
  padding: 8px;
}

.diag-entry-wrapper {
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.diag-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 5px 8px;
  border-radius: 6px;
  cursor: default;
  transition: background-color 0.15s;
}

.diag-entry:hover {
  background: color-mix(in srgb, var(--color-on-surface) 4%, transparent);
}

.diag-entry__time {
  color: var(--color-on-surface-variant);
  opacity: 0.65;
  flex-shrink: 0;
  font-size: 11px;
}

.diag-entry__code {
  font-weight: 600;
  color: var(--color-on-surface);
  flex-shrink: 0;
}

.diag-entry__msg {
  color: var(--color-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diag-entry__chevron {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--color-on-surface-variant);
  opacity: 0.5;
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.diag-entry__chevron.expanded {
  transform: rotate(90deg);
}

.diag-context {
  padding: 4px 8px 8px 30px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diag-context__row {
  display: flex;
  gap: 8px;
  font-size: 11px;
  font-family: var(--font-mono);
}

.diag-context__key {
  color: var(--color-primary);
  flex-shrink: 0;
  font-weight: 500;
  min-width: 60px;
}

.diag-context__value {
  color: var(--color-on-surface-variant);
  word-break: break-all;
}

/* ─── Context expand transition ──────────────── */

.context-expand-enter-active,
.context-expand-leave-active {
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}

.context-expand-enter-from,
.context-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.context-expand-enter-to,
.context-expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

.factory-reset {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-outline-variant);
}

.factory-reset__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface);
}

.factory-reset__button {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .factory-reset {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
