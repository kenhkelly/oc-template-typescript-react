"use strict";

const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");
const path = require("path");
const webpack = require("webpack");
const _ = require("lodash");

const createExcludeRegex = require("../createExcludeRegex");

module.exports = options => {
  const buildPath = options.buildPath || "/build";
  const production = options.production;
  const buildIncludes = options.buildIncludes.concat(
    "oc-template-typescript-react-compiler/utils"
  );
  const excludeRegex = createExcludeRegex(buildIncludes);
  const localIdentName = !production
    ? "oc__[path][name]-[ext]__[local]__[hash:base64:8]"
    : "[local]__[hash:base64:8]";

  const cssModuleLoader = {
    loader: require.resolve("css-loader"),
    options: {
      importLoaders: 1,
      modules: true,
      localIdentName,
      camelCase: true
    }
  };


  const postCssModuleLoader = {
    loader: require.resolve("postcss-loader"),
    options: {
      ident: "postcss",
      plugins: [
        require("postcss-import"),
        require("postcss-extend"),
        require("postcss-icss-values"),
        require("autoprefixer")
      ]
    }
  };

  const cssLoader = {
    test: /\.css$/,
    use: [
      MiniCssExtractPlugin.loader, cssModuleLoader, postCssModuleLoader
    ]
  };

  const sassLoader = {
    test: /\.scss$/,
    use: [
      MiniCssExtractPlugin.loader,
      cssModuleLoader,
      postCssModuleLoader,
      {
        loader: require.resolve("sass-loader"),
      }
    ]
  };

  let plugins = [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      allChunks: true,
      ignoreOrder: true
    }),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        production ? "production" : "development"
      )
    })
  ];
  if (production) {
    plugins = plugins.concat(new MinifyPlugin());
  }

  const cacheDirectory = !production;
  const polyfills = ["Object.assign"];

  return {
    mode: production ? "production" : "development",
    optimization: {
      // https://webpack.js.org/configuration/optimization/
      // Override production mode optimization for minification
      // As it currently breakes the build, still rely on babel-minify-webpack-plugin instead
      minimize: false
    },
    entry: options.viewPath,
    output: {
      path: buildPath,
      filename: options.publishFileName
    },
    externals: _.omit(options.externals, polyfills),
    module: {
      rules: [
        cssLoader,
        sassLoader,
        {
          test: /\.tsx?$/,
          exclude: excludeRegex,
          use: [
            {
              loader: require.resolve("babel-loader"),
              options: {
                cacheDirectory,
                babelrc: false,
                presets: [
                  [
                    require.resolve("babel-preset-env"),
                    { modules: false, loose: true }
                  ],
                  [require.resolve("babel-preset-react")]
                ],
                plugins: [
                  [require.resolve("babel-plugin-transform-object-rest-spread")]
                ]
              }
            },
            {
              loader: require.resolve("ts-loader"),
              options: {
                compilerOptions: {
                  outDir: buildPath,
                  noImplicitAny: true,
                  module: 'es6',
                  target: 'es5',
                  jsx: 'react',
                  allowJs: true,
                  sourceMap: false,
                  allowSyntheticDefaultImports: true,
                  baseUrl:  path.join(options.viewPath, '../../../node_modules')
                }
              }
            }
          ]
        }
      ]
    },
    plugins,
    resolve: {
      extensions: [ '.tsx', '.ts', '.js', '.json', '.css' ]
    }
  };
};
