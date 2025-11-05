declare module '@notifee/react-native' {
  // Minimal typing shim to satisfy TypeScript before the package is installed.
  const notifee: any;
  export default notifee;
  export type TimestampTrigger = any;
  export enum TriggerType { TIMESTAMP = 0 }
  export enum AndroidImportance { DEFAULT = 3, HIGH = 4 }
}
