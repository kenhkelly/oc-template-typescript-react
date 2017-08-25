"use strict";

const async = require("async");
const fs = require("fs-extra");
const hashBuilder = require("oc-hash-builder");
const minifyFile = require("oc-minify-file");
const ocViewWrapper = require("oc-view-wrapper");
const path = require("path");
const strings = require("oc-templates-messages");
const uuid = require("uuid/v4")();

const compiler = require("./compiler");
const { webpackConfigurator, reactComponentWrapper } = require("./utils");

module.exports = (options, callback) => {
  const viewFileName = options.componentPackage.oc.files.template.src;
  const viewPath = path.join(options.componentPath, viewFileName);
  const publishPath = options.publishPath;
  const publishFileName = options.publishFileName || "template.js";
  const componentPackage = options.componentPackage;
  const { getInfo } = require("../index");
  const externals = getInfo().externals.reduce((externals, dep) => {
    externals[dep.name] = dep.global;
    return externals;
  }, {});

  const compile = (options, cb) => {
    const config = webpackConfigurator({
      confTarget: "view",
      viewPath,
      externals,
      publishFileName
    });
    compiler(config, (err, memoryFs) => {
      const bundle = memoryFs.readFileSync(
        `/build/${config.output.filename}`,
        "UTF8"
      );

      if (err) {
        return cb(err);
      }

      const bundleHash = hashBuilder.fromString(bundle);
      const bundleName = "react-component.js";
      const bundlePath = path.join(publishPath, bundleName);
      const wrappedBundle = reactComponentWrapper(bundleHash, bundle);
      fs.outputFileSync(bundlePath, wrappedBundle);

      let css = null;
      if (memoryFs.data.build["main.css"]) {
        css = memoryFs.readFileSync(`/build/main.css`, "UTF8");
      }

      const templateString = `function(model){
        return \`<div id="${uuid}">\${ model.__html ? model.__html : '' }</div>
          <style>${minifyFile(".css", css)}</style>   
          <script>(function(){
            oc.require(
              ['oc', 'reactComponents', '${bundleHash}'],
              '\${model.reactComponent.props.staticPath}${bundleName}',
              function(App){
                var targetNode = document.getElementById("${uuid}");
                targetNode.setAttribute("id","");
                ReactDOM.render(React.createElement(App, \${JSON.stringify(model.reactComponent.props)}),targetNode);
              });
            }())
          </script>
        \`;
      }`;

      const hash = hashBuilder.fromString(templateString);
      const view = ocViewWrapper(hash, templateString);
      return cb(null, {
        template: { view, hash },
        bundle: { hash: bundleHash }
      });
    });
  };

  async.waterfall(
    [
      next =>
        compile({ viewPath, componentPackage }, (err, viewContent) =>
          next(err ? "not found" : null, viewContent)
        ),
      (compiled, next) => fs.ensureDir(publishPath, err => next(err, compiled)),
      (compiled, next) =>
        fs.writeFile(
          path.join(publishPath, publishFileName),
          compiled.template.view,
          err => next(err, compiled)
        )
    ],
    (err, compiled) => {
      if (err === "not found") {
        return callback(strings.errors.viewNotFound(viewFileName));
      } else if (err) {
        return callback(strings.errors.compilationFailed(viewFileName, err));
      }
      callback(null, {
        template: {
          type: options.componentPackage.oc.files.template.type,
          hashKey: compiled.template.hash,
          src: publishFileName
        },
        bundle: {
          hashKey: compiled.bundle.hash
        }
      });
    }
  );
};
