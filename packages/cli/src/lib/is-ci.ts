/**
 * Detects if the process is running in a CI environment.
 */
export function isCI() {
  const {env} = process;
  console.log('Printing process.env:');
  console.log(JSON.stringify(env, null, 2));

  return env.CI === 'false'
    ? false // Overrides
    : !!(env.CI || env.CI_NAME || env.BUILD_NUMBER || env.TF_BUILD);
}
