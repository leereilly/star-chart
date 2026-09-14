import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildChartModel, parseInputs, renderChartGif } from '../dist/lib.js';

function ffmpeg(args) {
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    {
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`ffmpeg exited with ${result.status}`);
}

/** Rebuild the existing light-build/dark-reverse social cut from example data. */
export async function generateVideos(root, source, asOf) {
  const work = join(root, '.scratch', 'example-video-render');
  const validation = join(root, 'assets', 'validation');
  // Refuse to overwrite an existing work directory; cleanup owns only this run.
  mkdirSync(join(root, '.scratch'), { recursive: true });
  mkdirSync(work);
  mkdirSync(validation, { recursive: true });
  try {
    for (const theme of ['light', 'dark']) {
      const { config } = parseInputs({
        repository: 'rails/rails',
        style: 'contributions',
        theme,
        width: '1800',
        height: '980',
        axis_font_size: '20',
        animation: 'once',
        animation_duration: '4s',
        animation_delay: '0s',
        animation_pause: '0s',
        animation_easing: 'ease-in-out',
        animate_total: 'true',
        show_change: 'false',
      });
      const model = buildChartModel(config, source.metadata, source.history, {
        asOf,
      });
      const gif = await renderChartGif(model, { width: 1080, fps: 20 });
      writeFileSync(join(work, `${theme}.gif`), gif.buffer);
      ffmpeg([
        '-i',
        join(work, `${theme}.gif`),
        '-vf',
        `select=eq(n\\,${gif.frameCount - 1})`,
        '-frames:v',
        '1',
        join(work, `${theme}.png`),
      ]);
      copyFileSync(
        join(work, `${theme}.png`),
        join(validation, `rails-${theme}-source.png`),
      );
    }
    const output = join(root, 'assets', 'rails-rails-social-loop.mp4');
    ffmpeg([
      '-i',
      join(work, 'light.gif'),
      '-i',
      join(work, 'dark.gif'),
      '-filter_complex',
      '[0:v]fps=30,setsar=1,format=yuv444p,split=2[light][copy];' +
        '[copy]trim=end_frame=1,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.8[blank];' +
        '[1:v]fps=30,setsar=1,format=yuv444p,reverse,setpts=PTS-STARTPTS[dark];' +
        '[light][dark]xfade=transition=fade:duration=0.6:offset=5.4[themes];' +
        '[themes][blank]xfade=transition=fade:duration=0.6:offset=10.8,format=yuv420p[out]',
      '-map',
      '[out]',
      '-an',
      '-t',
      '11.6',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '17',
      '-movflags',
      '+faststart',
      '-metadata',
      'title=rails/rails star history — light to dark',
      '-metadata',
      'comment=Deterministic synthetic example generated with leereilly/star-chart',
      output,
    ]);
    // Keep the existing candidate and primary cut on the same current render.
    copyFileSync(
      output,
      join(root, 'assets', 'rails-rails-social-loop-candidate.mp4'),
    );
    const times = [0, 1, 2, 3, 5, 6, 8, 10, 11.566667];
    for (const [index, time] of times.entries()) {
      ffmpeg([
        '-i',
        output,
        '-vf',
        `select=eq(n\\,${Math.round(time * 30)})`,
        '-frames:v',
        '1',
        join(work, `frame-${index}.png`),
      ]);
      copyFileSync(
        join(work, `frame-${index}.png`),
        join(validation, `frame-${String(index + 1).padStart(2, '0')}.png`),
      );
    }
    copyFileSync(
      join(validation, 'frame-05.png'),
      join(validation, 'candidate-01.png'),
    );
    copyFileSync(
      join(validation, 'frame-06.png'),
      join(validation, 'candidate-02.png'),
    );
    console.log(
      'Generated both Rails social MP4s (1080×588, 30 fps, 11.6s) and validation PNGs.',
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
