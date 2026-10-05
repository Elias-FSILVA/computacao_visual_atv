# O Escalador

Jogo 3D de escalada feito com [Three.js](https://threejs.org/), baseado no exemplo
[`misc_controls_pointerlock`](https://threejs.org/examples/#misc_controls_pointerlock).

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`).

## Controles

- `W A S D` — mover
- Mouse — olhar (clique na tela para travar o cursor)
- `Espaço` — pular
- `Esc` — pausar

## Funcionalidades

- Ambiente 3D personalizado: torre em espiral com blocos de rocha gerados
  proceduralmente, coluna central, decorações e plataforma final com farol.
- Sistema de pontuação: pontos pela altura alcançada e bônus por checkpoint
  (anéis dourados) coletado durante a subida.
- Ranking local (salvo no navegador) com as melhores pontuações/tempos.
- Tempo limite de 90 segundos para chegar ao topo, com bônus de pontos pelo
  tempo restante ao vencer.

## Estrutura

- `src/World.js` — geração do ambiente (torre, plataformas, checkpoints, céu).
- `src/Player.js` — controles em primeira pessoa, física simples e colisão.
- `src/Game.js` — estados do jogo, pontuação, cronômetro e UI.
- `src/Ranking.js` — persistência do ranking em `localStorage`.
