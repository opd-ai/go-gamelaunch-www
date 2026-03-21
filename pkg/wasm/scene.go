//go:build js

// Package wasm provides Scene interface for game state management.
package wasm

import "github.com/hajimehoshi/ebiten/v2"

// Scene represents a game scene that can be rendered
type Scene interface {
	// Update is called every tick to update scene state
	Update(game *Game) error

	// Draw renders the scene to the screen
	Draw(game *Game, screen *ebiten.Image)

	// OnEnter is called when the scene becomes active
	OnEnter(game *Game)

	// OnExit is called when the scene is deactivated
	OnExit(game *Game)
}

// SceneManager manages scene transitions
type SceneManager struct {
	currentScene Scene
	nextScene    Scene
}

// NewSceneManager creates a new scene manager
func NewSceneManager() *SceneManager {
	return &SceneManager{}
}

// SetScene queues a scene transition
func (sm *SceneManager) SetScene(scene Scene) {
	sm.nextScene = scene
}

// Update processes scene transitions and updates the current scene
func (sm *SceneManager) Update(game *Game) error {
	if sm.nextScene != nil {
		if sm.currentScene != nil {
			sm.currentScene.OnExit(game)
		}
		sm.currentScene = sm.nextScene
		sm.nextScene = nil
		if sm.currentScene != nil {
			sm.currentScene.OnEnter(game)
		}
	}

	if sm.currentScene != nil {
		return sm.currentScene.Update(game)
	}
	return nil
}

// Draw renders the current scene
func (sm *SceneManager) Draw(game *Game, screen *ebiten.Image) {
	if sm.currentScene != nil {
		sm.currentScene.Draw(game, screen)
	}
}

// GameScene is the main gameplay scene
type GameScene struct {
	renderer *TileRenderer
}

// NewGameScene creates a new game scene
func NewGameScene() *GameScene {
	return &GameScene{}
}

// Update implements Scene interface
func (gs *GameScene) Update(game *Game) error {
	return nil
}

// Draw implements Scene interface
func (gs *GameScene) Draw(game *Game, screen *ebiten.Image) {
	if gs.renderer != nil {
		gs.renderer.Draw(game, screen)
	}
}

// OnEnter implements Scene interface
func (gs *GameScene) OnEnter(game *Game) {
	gs.renderer = NewTileRenderer()
}

// OnExit implements Scene interface
func (gs *GameScene) OnExit(game *Game) {
	gs.renderer = nil
}

// SetRenderer sets the tile renderer for this scene
func (gs *GameScene) SetRenderer(r *TileRenderer) {
	gs.renderer = r
}
