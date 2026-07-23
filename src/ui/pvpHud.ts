// src/ui/pvpHud.ts — 보관함 블래스터 선택 + AI 드론 PVP 전투 HUD (leaf).
import type { Blaster, BlasterStats } from '../game/types.ts'
import { computeStats } from '../game/parts.ts'
import { makeStarBar } from './stars.ts'

export interface PvpHudCallbacks {
  onStart: (blasterId: string) => void
  onNext: () => void
  onRetry: () => void
  onCollection: () => void
}

export interface PvpBattleView {
  playerName: string
  rivalName: string
  round: number
  total: number
  playerHealth: number
  rivalHealth: number
  spreadDeg: number
}

export type PvpOutcomeKind = 'round-complete' | 'retry' | 'victory' | 'draw'

type LobbyStatKey = 'power' | 'fireRate' | 'accuracy' | 'handling'

const LOBBY_STATS: readonly { key: LobbyStatKey; label: string }[] = [
  { key: 'power', label: '팝 파워' },
  { key: 'fireRate', label: '연사' },
  { key: 'accuracy', label: '정확' },
  { key: 'handling', label: '다루기' },
]

interface HealthCard {
  el: HTMLElement
  name: HTMLElement
  value: HTMLElement
  fill: HTMLElement
  track: HTMLElement
}

export function createPvpHud(root: HTMLElement, cb: PvpHudCallbacks) {
  root.innerHTML = ''
  root.className = 'pvp-hud'

  const lobby = element('section', 'pvp-lobby')
  lobby.setAttribute('aria-label', 'PVP 블래스터 선택')

  const lobbyHeader = element('div', 'pvp-lobby-header')
  const lobbyHeading = element('div', 'pvp-lobby-heading')
  const eyebrow = element('div', 'pvp-eyebrow', 'PVP 팝 아레나')
  const title = element('h2', 'pvp-title', '보관함 블래스터로 참전!')
  const intro = element(
    'p',
    'pvp-intro',
    '내 블래스터를 골라 AI 드론과 팝 파워 대결! 모두 체력 10에서 시작해요.',
  )
  lobbyHeading.append(eyebrow, title, intro)

  const lobbyCollection = button('보관함으로', 'pvp-collection', cb.onCollection)
  lobbyHeader.append(lobbyHeading, lobbyCollection)
  lobby.appendChild(lobbyHeader)

  const loadoutGrid = element('div', 'pvp-loadout-grid')
  lobby.appendChild(loadoutGrid)

  const battle = element('section', 'pvp-battle')
  battle.hidden = true
  battle.setAttribute('aria-label', 'PVP AI 드론 대결')

  const battleTop = element('div', 'pvp-battle-top')
  const player = healthCard('player')
  const rival = healthCard('rival')
  const versus = element('div', 'pvp-versus')
  versus.innerHTML = '<strong>VS</strong><span>AI 드론</span>'
  battleTop.append(player.el, versus, rival.el)

  const roundEl = element('div', 'pvp-round')
  const hint = element(
    'div',
    'pvp-hint',
    '마우스로 조준 · 누르고 발사 · A/D로 피하기',
  )
  const reticle = element('div', 'pvp-reticle')
  const spreadRing = element('span', 'pvp-spread-ring')
  reticle.appendChild(spreadRing)
  const spread = element('div', 'pvp-spread')
  const spreadText = element('span', 'pvp-spread-text')
  spread.appendChild(spreadText)
  battle.append(roundEl, battleTop, hint, reticle, spread)

  const outcome = element('section', 'pvp-outcome')
  outcome.hidden = true
  outcome.setAttribute('role', 'dialog')
  outcome.setAttribute('aria-modal', 'true')
  const outcomeCard = element('div', 'pvp-outcome-card')
  const outcomeKicker = element('div', 'pvp-outcome-kicker', 'PVP 팝 리포트')
  const outcomeTitle = element('h2', 'pvp-outcome-title')
  const outcomeDetail = element('p', 'pvp-outcome-detail')
  const outcomeActions = element('div', 'pvp-outcome-actions')
  const nextButton = button('다음 라운드', 'pvp-next', cb.onNext)
  const retryButton = button('체력 10으로 다시!', 'pvp-retry', cb.onRetry)
  const outcomeCollection = button('보관함으로', 'pvp-collection', cb.onCollection)
  outcomeActions.append(nextButton, retryButton, outcomeCollection)
  outcomeCard.append(
    outcomeKicker,
    outcomeTitle,
    outcomeDetail,
    outcomeActions,
  )
  outcome.appendChild(outcomeCard)

  root.append(lobby, battle, outcome)

  function renderLobby(blasters: readonly Blaster[], activeId: string | null): void {
    loadoutGrid.replaceChildren()
    const sorted = [...blasters].sort((left, right) => {
      if (left.id === activeId) return -1
      if (right.id === activeId) return 1
      return right.createdAt - left.createdAt
    })

    if (sorted.length === 0) {
      const empty = element(
        'div',
        'pvp-empty',
        '보관함에서 블래스터를 먼저 만들어 주세요.',
      )
      loadoutGrid.appendChild(empty)
      return
    }

    for (const blaster of sorted) {
      const stats = computeStats(blaster)
      const active = blaster.id === activeId
      const card = element(
        'article',
        `pvp-loadout-card${active ? ' active' : ''}`,
      )

      const cardHead = element('div', 'pvp-loadout-head')
      const name = element('h3', 'pvp-loadout-name', blaster.name)
      cardHead.appendChild(name)
      if (active) {
        cardHead.appendChild(element('span', 'pvp-active-badge', '지금 장착'))
      }
      card.appendChild(cardHead)

      const statList = element('div', 'pvp-stat-list')
      for (const stat of LOBBY_STATS) {
        statList.appendChild(statRow(stat.label, stats, stat.key))
      }
      card.appendChild(statList)

      const start = button(
        active ? '이 블래스터로 참전' : '장착하고 참전',
        'pvp-start',
        () => cb.onStart(blaster.id),
      )
      start.setAttribute('aria-label', `${blaster.name}로 PVP 참전`)
      card.appendChild(start)
      loadoutGrid.appendChild(card)
    }
  }

  function setHealth(playerHealth: number, rivalHealth: number): void {
    updateHealth(player, playerHealth)
    updateHealth(rival, rivalHealth)
  }

  return {
    showLobby(blasters: readonly Blaster[], activeId: string | null): void {
      renderLobby(blasters, activeId)
      lobby.hidden = false
      battle.hidden = true
      outcome.hidden = true
    },

    showBattle(view: PvpBattleView): void {
      lobby.hidden = true
      battle.hidden = false
      outcome.hidden = true

      const round = positiveInt(view.round)
      const total = Math.max(round, positiveInt(view.total))
      roundEl.textContent = `PVP · 라운드 ${round} / ${total}`
      player.name.textContent = `나 · ${view.playerName}`
      rival.name.textContent = `AI 드론 · ${view.rivalName}`
      setHealth(view.playerHealth, view.rivalHealth)

      const spreadDeg = finite(view.spreadDeg, 0)
      spreadText.textContent = `팝 퍼짐 ${spreadDeg.toFixed(1)}°`
      const ringSize = Math.max(20, Math.min(64, 20 + spreadDeg * 8))
      spreadRing.style.setProperty('--pvp-spread-size', `${ringSize}px`)
    },

    setHealth,

    showOutcome(
      kind: PvpOutcomeKind,
      roundValue: number,
      totalValue: number,
    ): void {
      const round = positiveInt(roundValue)
      const total = Math.max(round, positiveInt(totalValue))
      lobby.hidden = true
      battle.hidden = false
      outcome.hidden = false
      outcome.dataset.kind = kind

      nextButton.hidden = kind !== 'round-complete'
      retryButton.hidden = kind === 'round-complete'
      retryButton.textContent =
        kind === 'victory' ? '새 PVP 시작' : '체력 10으로 다시!'

      if (kind === 'round-complete') {
        outcomeTitle.textContent = '라운드 팝 완료!'
        outcomeDetail.textContent =
          `${round} / ${total} 라운드를 멋지게 마쳤어요. 다음 AI 드론이 기다려요!`
      } else if (kind === 'retry') {
        outcomeTitle.textContent = '팝 에너지 충전!'
        outcomeDetail.textContent =
          'AI 드론이 먼저 빛났어요. 체력 10을 채우고 한 번 더 도전해요!'
      } else if (kind === 'victory') {
        outcomeTitle.textContent = 'PVP 팝 챔피언!'
        outcomeDetail.textContent =
          '보관함 블래스터로 AI 드론 도전을 모두 마쳤어요!'
      } else {
        outcomeTitle.textContent = '막상막하 팝!'
        outcomeDetail.textContent =
          '두 에너지 링이 함께 반짝였어요. 체력 10으로 다시 만나요!'
      }
    },

    setVisible(visible: boolean): void {
      root.hidden = !visible
      root.setAttribute('aria-hidden', String(!visible))
    },
  }
}

function statRow(
  label: string,
  stats: BlasterStats,
  key: LobbyStatKey,
): HTMLElement {
  const row = element('div', 'pvp-stat-row')
  const labelEl = element('span', 'pvp-stat-label', label)
  const stars = makeStarBar()
  stars.set(stats[key] / 2, stats[key] >= 10)
  stars.el.setAttribute('aria-label', `${label} 별 5개 중 ${formatStars(stats[key] / 2)}`)
  row.append(labelEl, stars.el)
  return row
}

function healthCard(side: 'player' | 'rival'): HealthCard {
  const el = element('div', `pvp-health-card ${side}`)
  const name = element('div', 'pvp-health-name')
  const value = element('div', 'pvp-health-value', '체력 10 / 10')
  const track = element('div', 'pvp-health-track')
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', '10')
  const fill = element('div', 'pvp-health-fill')
  track.appendChild(fill)
  el.append(name, value, track)
  return { el, name, value, fill, track }
}

function updateHealth(card: HealthCard, value: number): void {
  const health = Math.max(0, Math.min(10, finite(value, 0)))
  card.value.textContent = `체력 ${formatHealth(health)} / 10`
  card.fill.style.width = `${health * 10}%`
  card.track.setAttribute('aria-valuenow', String(health))
  card.el.classList.toggle('is-low', health > 0 && health <= 3)
  card.el.classList.toggle('is-empty', health <= 0)
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const node = element('button', className, label)
  node.type = 'button'
  node.addEventListener('click', onClick)
  return node
}

function positiveInt(value: number): number {
  return Math.max(1, Math.floor(finite(value, 1)))
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function formatHealth(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatStars(value: number): string {
  const clamped = Math.max(0, Math.min(5, value))
  return Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1)
}
