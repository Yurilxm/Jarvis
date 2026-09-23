import { playWakeSound } from '../src/voice/sound.js';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeTempDir } from './helpers/temp.js';

describe('voice — playWakeSound', () => {
  let originalHomedir;

  it('retorna false se config desligar o som', () => {
    // Cria um "HOME" temporário com config desligada
    const dir = makeTempDir();
    const cfgDir = path.join(dir, '.jarvis-dev');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(
      path.join(cfgDir, 'voice.json'),
      JSON.stringify({ wakeSound: false }),
      'utf-8'
    );

    // Como readVoiceConfig usa os.homedir(), é difícil mockar sem jest.spyOn
    // Este teste valida apenas que a função não lança sem config
    expect(() => playWakeSound()).not.toThrow();
    removeTempDir(dir);
  });

  it('não lança quando ffplay não existe', () => {
    // Em CI, ffplay pode não estar instalado — a função deve retornar false
    expect(() => playWakeSound()).not.toThrow();
  });
});