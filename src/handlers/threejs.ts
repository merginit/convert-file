import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

class threejsHandler implements FormatHandler {

  public name: string = "threejs";
  public supportedFormats = [
    {
      name: "GL Transmission Format Binary",
      format: "glb",
      extension: "glb",
      mime: "model/gltf-binary",
      from: true,
      to: false,
      internal: "glb"
    },
    {
      name: "Wavefront OBJ",
      format: "obj",
      extension: "obj",
      mime: "model/obj",
      from: true,
      to: false,
      internal: "obj"
    },
    {
      name: "Autodesk FBX",
      format: "fbx",
      extension: "fbx",
      mime: "application/octet-stream",
      from: true,
      to: false,
      internal: "fbx"
    },
    {
      name: "Stereolithography",
      format: "stl",
      extension: "stl",
      mime: "model/stl",
      from: true,
      to: false,
      internal: "stl"
    },
    {
      name: "Polygon File Format",
      format: "ply",
      extension: "ply",
      mime: "application/ply",
      from: true,
      to: false,
      internal: "ply"
    },
    {
      name: "Portable Network Graphics",
      format: "png",
      extension: "png",
      mime: "image/png",
      from: false,
      to: true,
      internal: "png"
    },
    {
      name: "Joint Photographic Experts Group JFIF",
      format: "jpeg",
      extension: "jpg",
      mime: "image/jpeg",
      from: false,
      to: true,
      internal: "jpeg"
    },
    {
      name: "WebP",
      format: "webp",
      extension: "webp",
      mime: "image/webp",
      from: false,
      to: true,
      internal: "webp"
    },
  ];
  public ready: boolean = false;

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(90, 16 / 9, 0.1, 4096);
  private renderer = new THREE.WebGLRenderer();

  async init () {
    this.renderer.setSize(960, 540);
    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {

      const blob = new Blob([inputFile.bytes as BlobPart]);
      const url = URL.createObjectURL(blob);

      let scene: THREE.Group | THREE.Scene;

      if (inputFormat.internal === "glb") {
        const gltf: GLTF = await new Promise((resolve, reject) => {
          const loader = new GLTFLoader();
          loader.load(url, resolve, undefined, reject);
        });
        scene = gltf.scene;
      } else if (inputFormat.internal === "obj") {
        scene = await new Promise((resolve, reject) => {
          const loader = new OBJLoader();
          loader.load(url, resolve, undefined, reject);
        });
      } else if (inputFormat.internal === "fbx") {
        scene = await new Promise((resolve, reject) => {
          const loader = new FBXLoader();
          loader.load(url, resolve, undefined, reject);
        });
      } else if (inputFormat.internal === "stl") {
        const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
          const loader = new STLLoader();
          loader.load(url, resolve, undefined, reject);
        });
        const material = new THREE.MeshNormalMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        scene = new THREE.Group();
        scene.add(mesh);
      } else if (inputFormat.internal === "ply") {
        const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
          const loader = new PLYLoader();
          loader.load(url, resolve, undefined, reject);
        });
        const material = new THREE.MeshNormalMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        scene = new THREE.Group();
        scene.add(mesh);
      } else {
        throw "Invalid input format.";
      }

      const bbox = new THREE.Box3().setFromObject(scene);
      this.camera.position.z = bbox.max.z * 2;

      this.scene.add(scene);
      this.renderer.render(this.scene, this.camera);
      this.scene.remove(scene);

      const bytes: Uint8Array = await new Promise((resolve, reject) => {
        this.renderer.domElement.toBlob((blob) => {
          if (!blob) return reject("Canvas output failed");
          blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
        }, outputFormat.mime);
      });
      const name = inputFile.name.split(".")[0] + "." + outputFormat.extension;
      outputFiles.push({ bytes, name });

    }

    return outputFiles;
  }

}

export default threejsHandler;