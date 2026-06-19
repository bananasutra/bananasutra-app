import { useEffect, useRef } from 'react'
import './MonkeyGame.css'

// ─── constants (logical canvas coords) ────────────────────────────────────────
const LW = 600          // logical width
const LH = 160          // logical height
const GROUND_Y = 118    // y of ground line
const MONKEY_X = 78     // monkey fixed x
const MONKEY_SZ = 38    // emoji font size (px)
const PEEL_SZ = 34      // emoji font size (px)
const GRAVITY = 0.55
const JUMP_VEL = -12.5
const BASE_SPEED = 4.5
const MAX_SPEED = 9.5

type Status = 'idle' | 'running' | 'dead'

// ─── component ────────────────────────────────────────────────────────────────
export function MonkeyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scoreEl = useRef<HTMLSpanElement>(null)
  const highEl = useRef<HTMLSpanElement>(null)
  const overlayEl = useRef<HTMLDivElement>(null)
  const msgEl = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = LW * dpr
    canvas.height = LH * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const cssVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim()

    const getHS = () => { try { return parseInt(localStorage.getItem('bs-monkey-hs') || '0') } catch { return 0 } }
    const saveHS = (n: number) => { try { localStorage.setItem('bs-monkey-hs', String(n)) } catch {} }

    // ── mutable game state ──────────────────────────────────────────────────
    let status: Status = 'idle'
    let monkeyY = GROUND_Y - MONKEY_SZ
    let monkeyVY = 0
    let peels: { x: number; id: number }[] = []
    let score = 0
    let speed = BASE_SPEED
    let frame = 0
    let nextPeel = 72
    let peelId = 0
    let animId = 0

    if (highEl.current) highEl.current.textContent = String(getHS())

    // ── draw ────────────────────────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, LW, LH)

      // Ground line
      ctx.strokeStyle = cssVar('--color-border')
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      ctx.lineTo(LW, GROUND_Y)
      ctx.stroke()

      // Ground texture: subtle dots
      ctx.fillStyle = cssVar('--color-border')
      for (let x = 10; x < LW; x += 20) {
        ctx.fillRect(x, GROUND_Y + 4, 2, 2)
      }

      // Monkey — bob slightly when running on ground
      const onGround = monkeyY >= GROUND_Y - MONKEY_SZ - 2
      const bob = (status === 'running' && onGround) ? Math.sin(frame * 0.28) * 1.5 : 0
      ctx.font = `${MONKEY_SZ}px serif`
      ctx.textBaseline = 'bottom'
      ctx.fillText('🐒', MONKEY_X, monkeyY + MONKEY_SZ + bob)

      // Peels
      ctx.font = `${PEEL_SZ}px serif`
      for (const p of peels) {
        ctx.fillText('🍌', p.x, GROUND_Y + 2)
      }
    }

    // ── game loop ───────────────────────────────────────────────────────────
    function loop() {
      frame++

      // Physics
      monkeyVY += GRAVITY
      monkeyY += monkeyVY
      if (monkeyY >= GROUND_Y - MONKEY_SZ) {
        monkeyY = GROUND_Y - MONKEY_SZ
        monkeyVY = 0
      }

      // Score + speed
      score = Math.floor(frame / 6)
      speed = Math.min(BASE_SPEED + frame * 0.004, MAX_SPEED)
      if (scoreEl.current) scoreEl.current.textContent = String(score)

      // Spawn peels
      nextPeel--
      if (nextPeel <= 0) {
        peels.push({ x: LW + 10, id: peelId++ })
        const gap = Math.max(44, 85 - score * 0.25)
        nextPeel = gap + Math.random() * 36
      }

      // Move + prune
      for (const p of peels) p.x -= speed
      peels = peels.filter(p => p.x > -60)

      // Collision — forgiving hitboxes (~60% of emoji bounding box)
      const mL = MONKEY_X + 10
      const mR = MONKEY_X + MONKEY_SZ - 12
      const mT = monkeyY + 10
      const mB = monkeyY + MONKEY_SZ - 4

      for (const p of peels) {
        const pL = p.x + 7
        const pR = p.x + PEEL_SZ - 7
        const pT = GROUND_Y - PEEL_SZ + 8
        const pB = GROUND_Y - 4
        if (mR > pL && mL < pR && mB > pT && mT < pB) {
          die()
          return
        }
      }

      draw()
      animId = requestAnimationFrame(loop)
    }

    // ── state transitions ───────────────────────────────────────────────────
    function startGame() {
      cancelAnimationFrame(animId)
      status = 'running'
      monkeyY = GROUND_Y - MONKEY_SZ
      monkeyVY = 0
      peels = []
      score = 0
      speed = BASE_SPEED
      frame = 0
      nextPeel = 72
      if (scoreEl.current) scoreEl.current.textContent = '0'
      if (overlayEl.current) overlayEl.current.style.display = 'none'
      animId = requestAnimationFrame(loop)
    }

    function die() {
      status = 'dead'
      cancelAnimationFrame(animId)
      const hs = Math.max(score, getHS())
      saveHS(hs)
      if (highEl.current) highEl.current.textContent = String(hs)
      if (overlayEl.current) overlayEl.current.style.display = 'flex'
      if (msgEl.current) msgEl.current.textContent = `YOU SLIPPED — ${score} pts · Space or tap to retry`
      draw()
    }

    function doJump() {
      if (status === 'idle' || status === 'dead') {
        startGame()
        return
      }
      // Jump only when on (or very near) ground
      if (monkeyY >= GROUND_Y - MONKEY_SZ - 2) {
        monkeyVY = JUMP_VEL
      }
    }

    // Initial draw
    draw()

    // ── events ──────────────────────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        doJump()
      }
    }
    window.addEventListener('keydown', onKey)

    // Pointer on the stage element (set up via the div's onPointerDown below)
    // We use a module-level ref so we can wire this up imperatively
    const stage = canvas.parentElement!
    const onPointer = () => doJump()
    stage.addEventListener('pointerdown', onPointer)

    return () => {
      window.removeEventListener('keydown', onKey)
      stage.removeEventListener('pointerdown', onPointer)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <div className="monkey-game">
      <div className="monkey-game__hud">
        <span>Score: <span ref={scoreEl}>0</span></span>
        <span>Best: <span ref={highEl}>0</span></span>
      </div>
      <div className="monkey-game__stage">
        <canvas
          ref={canvasRef}
          className="monkey-game__canvas"
        />
        <div className="monkey-game__overlay" ref={overlayEl}>
          <p className="monkey-game__overlay-msg" ref={msgEl}>
            Space or tap to start
          </p>
        </div>
      </div>
    </div>
  )
}
