export async function verifyHealthPermission(
  provider: { checkPermissionsStatus: () => Promise<{ status: string }> },
  permissionType: string
): Promise<boolean> {
  try {
    const permissionState = await provider.checkPermissionsStatus();

    if (permissionState.status !== 'granted') {
      console.warn(`[HealthProvider] Permission not granted for ${permissionType}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `[HealthProvider] Error verifying ${permissionType} permission:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}
