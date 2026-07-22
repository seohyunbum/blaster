// src/game/budgets.ts — 코드·테스트가 함께 쓰는 성능 예산 정본.
export const PERFORMANCE_BUDGETS = Object.freeze({
  projectilePool: 64,
  maxPartMeshes: 14,
  maxBlasterMeshes: 56,
  maxSceneDrawCalls: 300,
  maxVisibleMeshes: 800,
  maxAverageFrameMs: 8,
})
