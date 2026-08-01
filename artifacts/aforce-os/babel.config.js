module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          // React Compiler scope (SDK 54 `experiments.reactCompiler`). Limit it to
          // OUR app source. babel-plugin-react-compiler's default `sources` compiles
          // every non-node_modules file, which sweeps in the workspace `lib/*`
          // packages — including the generated `@workspace/api-client-react` React
          // Query hooks (exported as source). Compiling those generated hooks emits
          // a `useMemoCache` call that crashes on the web target
          // ("Cannot read properties of null (reading 'useMemoCache')"), tripping the
          // root ErrorBoundary on /profile and /leaderboard (which consume
          // useGetMyReferralInfo / useGetReferralLeaderboard). The compiler is meant
          // for our components, not generated library code — so exclude `lib/`.
          "react-compiler": {
            sources: (filename) =>
              !filename.includes("/node_modules/") && !filename.includes("/lib/"),
          },
        },
      ],
    ],
  };
};
