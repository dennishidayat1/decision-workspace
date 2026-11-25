// Android's emulator maps 10.0.2.2 to the development host; localhost is the device.
export function developmentApiUrl(hostname: string | undefined): string {
  return hostname === '10.0.2.2'
    ? 'http://10.0.2.2:5207/api'
    : 'http://localhost:5207/api';
}
