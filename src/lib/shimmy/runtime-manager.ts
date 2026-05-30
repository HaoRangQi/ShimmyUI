import {
  RuntimeOperationBusyError,
  createRuntimeManager,
  latestShimmyRelease,
  platformAssetNames,
  readVerifiedRuntimeFile,
  selectReleaseAsset,
  verifySha256,
  withRuntimeOperationLock,
  type RuntimeCoreConfig,
} from "./runtime-core.mjs";
import { configStore } from "./config-store";

const runtimeManager = createRuntimeManager({
  readConfig: () => configStore.read(),
  writeConfig: (input: RuntimeCoreConfig) => configStore.write(input),
});

const managedBinaryPath = runtimeManager.managedBinaryPath;
const runtimeStatus = runtimeManager.runtimeStatus;
const downloadRuntime = runtimeManager.downloadRuntime;
const installRuntime = runtimeManager.installRuntime;
const updateRuntime = runtimeManager.updateRuntime;
const uninstallRuntime = runtimeManager.uninstallRuntime;
const rollbackRuntime = runtimeManager.rollbackRuntime;

export {
  RuntimeOperationBusyError,
  downloadRuntime,
  installRuntime,
  latestShimmyRelease,
  managedBinaryPath,
  platformAssetNames,
  readVerifiedRuntimeFile,
  rollbackRuntime,
  runtimeStatus,
  selectReleaseAsset,
  uninstallRuntime,
  updateRuntime,
  verifySha256,
  withRuntimeOperationLock,
};
