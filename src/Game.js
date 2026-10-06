import { Ranking } from "./Ranking.js";

const TIME_LIMIT = 90;
const HEIGHT_POINTS_PER_METER = 10;
const FINISH_TIME_BONUS_PER_SECOND = 5;
const CHECKPOINT_RADIUS = 1.1;
const FINISH_RADIUS_EXTRA = 0.6;

const el = (id) => document.getElementById(id);

export class Game {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    this.ranking = new Ranking();

    this.state = "menu";
    this.timeLeft = TIME_LIMIT;
    this.checkpointScore = 0;
    this.lastCheckpoint = null;
    this.scoreSaved = false;

    this._cacheDom();
    this._bindUI();
    this._renderRanking();
  }

  _cacheDom() {
    this.dom = {
      hud: el("hud"),
      hudHeight: el("hud-height"),
      hudScore: el("hud-score"),
      hudTimer: el("hud-timer"),
      hudTimerBox: el("hud-timer-box"),
      hudCheckpoint: el("hud-checkpoint"),
      hudCheckpointPts: el("hud-checkpoint-pts"),
      menu: el("overlay-menu"),
      pause: el("overlay-pause"),
      end: el("overlay-end"),
      rankingOverlay: el("overlay-ranking"),
      blocker: el("blocker"),
      playerName: el("player-name"),
      endTitle: el("end-title"),
      endMessage: el("end-message"),
      endScore: el("end-score"),
      endHeight: el("end-height"),
      endTime: el("end-time"),
      rankingList: el("ranking-list"),
      rankingEmpty: el("ranking-empty"),
    };
  }

  _bindUI() {
    el("btn-start").addEventListener("click", () => this._startGame());
    el("btn-show-ranking").addEventListener("click", () => this._openRanking());
    el("btn-ranking-close").addEventListener("click", () => this._closeRanking());
    el("btn-ranking-clear").addEventListener("click", () => {
      this.ranking.clear();
      this._renderRanking();
    });

    el("btn-resume").addEventListener("click", () => this.player.controls.lock());
    el("btn-quit").addEventListener("click", () => this._toMenu());

    el("btn-retry").addEventListener("click", () => this._startGame());
    el("btn-end-menu").addEventListener("click", () => this._toMenu());
    el("btn-save-score").addEventListener("click", () => this._saveScore());

    this.player.controls.addEventListener("lock", () => {
      this.dom.blocker.classList.add("hidden");
      this.dom.menu.classList.add("hidden");
      this.dom.pause.classList.add("hidden");
      if (this.state === "paused") this.state = "playing";
    });

    this.player.controls.addEventListener("unlock", () => {
      if (this.state === "playing") {
        this.state = "paused";
        this.dom.pause.classList.remove("hidden");
        this.dom.blocker.classList.remove("hidden");
      }
    });
  }

  _startGame() {
    const name = this.dom.playerName.value.trim();
    this.playerName = name.length ? name.slice(0, 16) : "Jogador";

    this.player.reset();
    this.timeLeft = TIME_LIMIT;
    this.checkpointScore = 0;
    this.lastCheckpoint = null;
    this.scoreSaved = false;
    for (const cp of this.world.checkpoints) cp.collected = false;

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    this.state = "playing";
    this.dom.menu.classList.add("hidden");
    this.dom.end.classList.add("hidden");
    this.dom.pause.classList.add("hidden");
    this.dom.hud.classList.remove("hidden");
    this.dom.hudTimerBox.classList.remove("warning");

    this.player.controls.lock();
  }

  _toMenu() {
    this.state = "menu";
    this.player.controls.unlock();
    this.dom.hud.classList.add("hidden");
    this.dom.pause.classList.add("hidden");
    this.dom.end.classList.add("hidden");
    this.dom.rankingOverlay.classList.add("hidden");
    this.dom.menu.classList.remove("hidden");
    this.dom.blocker.classList.remove("hidden");
  }

  _openRanking() {
    this.dom.menu.classList.add("hidden");
    this.dom.rankingOverlay.classList.remove("hidden");
  }

  _closeRanking() {
    this.dom.rankingOverlay.classList.add("hidden");
    if (this.state === "menu") this.dom.menu.classList.remove("hidden");
  }

  _renderRanking() {
    const entries = this.ranking.load();
    this.dom.rankingList.innerHTML = "";
    if (!entries.length) {
      this.dom.rankingEmpty.classList.remove("hidden");
      return;
    }
    this.dom.rankingEmpty.classList.add("hidden");
    for (const entry of entries) {
      const li = document.createElement("li");

      const name = document.createElement("span");
      name.className = "rk-name";
      name.textContent = entry.name;

      const meta = document.createElement("div");
      meta.className = "rk-meta";
      meta.textContent = `${entry.result === "win" ? "Chegou ao topo" : "Não terminou"} · ${entry.time}s · ${entry.date}`;

      li.append(name, ` — ${entry.score} pts`, meta);
      this.dom.rankingList.appendChild(li);
    }
  }

  _currentScore() {
    const heightScore = Math.floor(this.player.maxHeightReached) * HEIGHT_POINTS_PER_METER;
    return heightScore + this.checkpointScore;
  }

  _showCheckpointToast(points) {
    this.dom.hudCheckpointPts.textContent = points;
    this.dom.hudCheckpoint.classList.remove("hidden");
    this.dom.hudCheckpoint.style.animation = "none";
    requestAnimationFrame(() => {
      this.dom.hudCheckpoint.style.animation = "";
    });
  }

  _endGame(result) {
    this.state = result;
    this.player.controls.unlock();
    this.dom.hud.classList.add("hidden");
    this.dom.blocker.classList.remove("hidden");

    let score = this._currentScore();
    const elapsed = TIME_LIMIT - this.timeLeft;
    if (result === "won") {
      score += Math.floor(this.timeLeft * FINISH_TIME_BONUS_PER_SECOND);
      this.dom.endTitle.textContent = "🏁 Você chegou ao topo!";
      this.dom.endMessage.textContent = "Parabéns, escalador! Bônus de tempo aplicado.";
    } else {
      this.dom.endTitle.textContent = "⏱️ Tempo esgotado";
      this.dom.endMessage.textContent = "Você não chegou ao topo a tempo. Tente novamente!";
    }

    this.finalScore = score;
    this.finalResult = result === "won" ? "win" : "lose";
    this.finalTime = elapsed;

    this.dom.endScore.textContent = score;
    this.dom.endHeight.textContent = Math.floor(this.player.maxHeightReached);
    this.dom.endTime.textContent = elapsed;
    this.dom.end.classList.remove("hidden");
  }

  _saveScore() {
    if (this.scoreSaved) return;
    this.ranking.save({
      name: this.playerName || "Jogador",
      score: this.finalScore,
      time: this.finalTime,
      result: this.finalResult,
      date: new Date().toLocaleDateString("pt-BR"),
    });
    this.scoreSaved = true;
    el("btn-save-score").textContent = "Salvo!";
    this._renderRanking();
  }

  _checkCheckpoints() {
    const p = this.player.position;
    for (const cp of this.world.checkpoints) {
      if (cp.collected) continue;
      const dist = Math.hypot(p.x - cp.x, p.z - cp.z, p.y - cp.y);
      if (dist < CHECKPOINT_RADIUS) {
        cp.collected = true;
        this.checkpointScore += cp.points;
        this.lastCheckpoint = { x: cp.x, y: cp.y - 1.4, z: cp.z };
        this._showCheckpointToast(cp.points);
      }
    }
  }

  _checkFinish() {
    const f = this.world.finish;
    const p = this.player.position;
    const dist = Math.hypot(p.x - f.x, p.z - f.z, p.y - f.y);
    if (dist < f.radius + FINISH_RADIUS_EXTRA) {
      this._endGame("won");
    }
  }

  update(delta) {
    if (this.state !== "playing") return;

    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this._updateHud();
      this._endGame("lost");
      return;
    }

    if (this.player.fellOff) {
      const respawn = this.lastCheckpoint
        ? { x: this.lastCheckpoint.x, y: this.lastCheckpoint.y, z: this.lastCheckpoint.z }
        : this.world.spawnPoint;
      this.player.respawnAt(respawn);
      this.player.fellOff = false;
    }

    this._checkCheckpoints();
    this._checkFinish();
    this._updateHud();
  }

  _updateHud() {
    this.dom.hudHeight.textContent = Math.max(0, Math.floor(this.player.position.y));
    this.dom.hudScore.textContent = this._currentScore();
    const t = Math.ceil(this.timeLeft);
    this.dom.hudTimer.textContent = t;
    this.dom.hudTimerBox.classList.toggle("warning", t <= 15);
  }
}
