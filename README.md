# traktor-connect

Library to receive track metadata from Traktor Pro via OGG Vorbis broadcast.

## Installation

```bash
npm install traktor-connect
```

## Usage

```typescript
import { TraktorConnect } from 'traktor-connect';

const traktor = new TraktorConnect({ port: 8000 });

traktor.on('track', (data) => {
  console.log(`Now playing: ${data.artist} - ${data.title}`);
});

traktor.on('connected', () => {
  console.log('Traktor connected');
});

traktor.on('disconnected', () => {
  console.log('Traktor disconnected');
});

await traktor.start();
```

## Traktor Configuration

1. Open Traktor Pro preferences
2. Go to **Broadcasting** section
3. Set **Server** to your machine's IP address
4. Set **Port** to `8000` (or your custom port)
5. Set **Format** to **Ogg Vorbis**
6. Enable broadcasting

## API

### `new TraktorConnect(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `8000` | TCP port to listen on |
| `skipFirstTrack` | `boolean` | `true` | Skip the first track (Traktor sends current track on connect) |
| `logger` | `Logger` | `noopLogger` | Logger implementation |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `track` | `TraktorTrackData` | New track detected |
| `connected` | - | Traktor connected to the server |
| `disconnected` | - | Traktor disconnected |
| `ready` | - | Server is listening |
| `error` | `Error` | An error occurred |

### Methods

- `start(): Promise<void>` - Start the TCP server
- `stop(): Promise<void>` - Stop the server and clean up
- `configure(options): Promise<void>` - Update configuration at runtime

## License

MIT
