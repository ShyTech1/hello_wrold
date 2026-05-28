import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { VideoFile } from './types';

interface Props {
  currentVideo: VideoFile | null;
  muted: boolean;
  volume: number;
  showControls: boolean;
  fullscreen: boolean;
  paused: boolean;
  onEnded: () => void;
  onError: () => void;
  onPlaybackStateChange: (paused: boolean) => void;
}

export interface VideoPlayerHandle {
  pause: () => void;
  play: () => void;
  clear: () => void;
}

const MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/mp4',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo'
};

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'video/mp4';
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { currentVideo, muted, volume, showControls, fullscreen, paused, onEnded, onError, onPlaybackStateChange }: Props,
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Read the video file into memory and create a Blob URL.
  // The file handle is opened, read, and closed immediately — no OS lock
  // is held during playback, so deletion works at any time.
  useEffect(() => {
    if (!currentVideo) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;

    window.electronAPI.readVideoFile(currentVideo.path).then((buffer) => {
      if (cancelled) return;
      // Slice to a plain ArrayBuffer — IPC returns Uint8Array<ArrayBufferLike>
      // which TypeScript won't accept as BlobPart directly.
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], { type: getMimeType(currentVideo.path) });
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }).catch(() => {
      if (!cancelled) onError();
    });

    return () => {
      cancelled = true;
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [currentVideo?.id]);

  useImperativeHandle(ref, () => ({
    pause: () => {
      videoRef.current?.pause();
    },
    play: () => {
      if (videoRef.current) {
        void videoRef.current.play().catch(() => undefined);
      }
    },
    clear: () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    }
  }), []);

  useEffect(() => {
    void window.electronAPI.setFullScreen(fullscreen);
  }, [fullscreen]);

  useEffect(() => {
    if (videoRef.current) {
      void videoRef.current.play().catch(() => undefined);
    }
  }, [currentVideo]);

  useEffect(() => {
    if (!videoRef.current || !currentVideo) {
      return;
    }

    if (paused) {
      videoRef.current.pause();
      return;
    }

    void videoRef.current.play().catch(() => undefined);
  }, [currentVideo, paused]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.volume = volume;
  }, [volume]);

  if (!currentVideo) {
    return (
      <div className="empty-state" role="status">
        <div>
          <p>Live preview</p>
          <p style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.7 }}>
            Pick a folder or add videos to start the loop.
          </p>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return <div className="empty-state" role="status">Loading…</div>;
  }

  return (
    <video
      ref={videoRef}
      key={currentVideo.id}
      src={blobUrl}
      autoPlay
      muted={muted}
      controls={showControls}
      onPlay={() => onPlaybackStateChange(false)}
      onPause={() => onPlaybackStateChange(true)}
      onEnded={onEnded}
      onError={onError}
      className="video-player"
    />
  );
});
