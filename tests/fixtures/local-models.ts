import { crc32, deflateSync } from 'node:zlib';

export function createModelTexturePng(): Buffer {
  function chunk(kind: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const content = Buffer.concat([Buffer.from(kind), data]);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(content));
    return Buffer.concat([length, content, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 255, 128, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

export function modelDocument(animated = false): Record<string, unknown> {
  return {
    asset: { version: '2.0', generator: 'nuanban local synthetic fixture' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Pet', mesh: 0 }], buffers: [{ byteLength: animated ? 136 : 96 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 60 }, { buffer: 0, byteOffset: 60, byteLength: 36 },
      ...(animated ? [{ buffer: 0, byteOffset: 96, byteLength: 8 }, { buffer: 0, byteOffset: 104, byteLength: 32 }] : [])],
    accessors: [{ bufferView: 0, componentType: 5126, count: 5, type: 'VEC3', min: [-0.7, -0.7, -0.7], max: [0.7, 0.8, 0.7] },
      { bufferView: 1, componentType: 5123, count: 18, type: 'SCALAR' },
      ...(animated ? [{ bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] }, { bufferView: 3, componentType: 5126, count: 2, type: 'VEC4' }] : [])],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.85, 0.42, 0.2, 1], metallicFactor: 0, roughnessFactor: 0.7 }, doubleSided: true }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    ...(animated ? { animations: [{ name: 'turn', samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }] }] } : {}),
  };
}

export function createModelGlb(document: Record<string, unknown> = modelDocument()): Buffer {
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(padded);
  const animated = Array.isArray(document.animations) && document.animations.length > 0;
  const binary = Buffer.alloc(animated ? 136 : 96);
  Buffer.from(new Float32Array([-0.7, -0.7, 0.7, 0.7, -0.7, 0.7, 0.7, -0.7, -0.7, -0.7, -0.7, -0.7, 0, 0.8, 0]).buffer).copy(binary);
  Buffer.from(new Uint16Array([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 3, 2, 0, 2, 1]).buffer).copy(binary, 60);
  if (animated) {
    Buffer.from(new Float32Array([0, 1]).buffer).copy(binary, 96);
    Buffer.from(new Float32Array([0, 0, 0, 1, 0, Math.SQRT1_2, 0, Math.SQRT1_2]).buffer).copy(binary, 104);
  }
  const result = Buffer.alloc(12 + 8 + padded.length + 8 + binary.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  result.writeUInt32LE(binary.length, 20 + padded.length); result.writeUInt32LE(0x004e4942, 24 + padded.length); binary.copy(result, 28 + padded.length);
  return result;
}

export function createModelVrm(version: '0' | '1' = '1', mtoon = false): Buffer {
  const document = modelDocument();
  const boneNames = ['hips', 'spine', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
  const nodes = [{ name: 'Pet', mesh: 0, children: [1] },
    { name: 'hips', translation: [0, 0, 0], children: [2, 10, 13] }, { name: 'spine', translation: [0, 0.4, 0], children: [3, 4, 7] },
    { name: 'head', translation: [0, 0.5, 0] }, { name: 'leftUpperArm', translation: [0.2, 0.3, 0], children: [5] },
    { name: 'leftLowerArm', translation: [0.3, 0, 0], children: [6] }, { name: 'leftHand', translation: [0.3, 0, 0] },
    { name: 'rightUpperArm', translation: [-0.2, 0.3, 0], children: [8] }, { name: 'rightLowerArm', translation: [-0.3, 0, 0], children: [9] }, { name: 'rightHand', translation: [-0.3, 0, 0] },
    { name: 'leftUpperLeg', translation: [0.1, -0.1, 0], children: [11] }, { name: 'leftLowerLeg', translation: [0, -0.3, 0], children: [12] }, { name: 'leftFoot', translation: [0, -0.3, 0.1] },
    { name: 'rightUpperLeg', translation: [-0.1, -0.1, 0], children: [14] }, { name: 'rightLowerLeg', translation: [0, -0.3, 0], children: [15] }, { name: 'rightFoot', translation: [0, -0.3, 0.1] }];
  document.nodes = nodes;
  if (version === '1') {
    document.extensionsUsed = ['VRMC_vrm'];
    document.extensions = { VRMC_vrm: { specVersion: '1.0', meta: { name: 'Synthetic VRM', version: '1', authors: ['nuanban tests'], licenseUrl: 'https://vrm.dev/licenses/1.0/' },
      humanoid: { humanBones: Object.fromEntries(boneNames.map((bone, index) => [bone, { node: index + 1 }])) } } };
  } else {
    document.extensionsUsed = ['VRM'];
    document.extensions = { VRM: { specVersion: '0.0', meta: { title: 'Synthetic VRM', author: 'nuanban tests', version: '1', licenseName: 'CC0' },
      humanoid: { humanBones: boneNames.map((bone, index) => ({ bone, node: index + 1, useDefaultValues: true })) } } };
  }
  if (mtoon && version === '1') {
    document.extensionsUsed = ['VRMC_vrm', 'VRMC_materials_mtoon'];
    document.materials = [{ pbrMetallicRoughness: { baseColorFactor: [0.85, 0.42, 0.2, 1] }, doubleSided: true,
      extensions: { VRMC_materials_mtoon: { specVersion: '1.0', shadeColorFactor: [0.6, 0.2, 0.1], shadingShiftFactor: 0, shadingToonyFactor: 0.9, outlineWidthMode: 'none' } } }];
  }
  return createModelGlb(document);
}

export function createModelFbx(): Buffer {
  return Buffer.from('; FBX 7.4.0 project file\nFBXHeaderExtension:  {\n\tFBXVersion: 7400\n}\nObjects:  {\n\tGeometry: 1, "Geometry::Pet", "Mesh" {\n\t\tVertices: *12 {\n\t\t\ta: 0,1,0,-1,-1,1,1,-1,1,0,-1,-1\n\t\t}\n\t\tPolygonVertexIndex: *12 {\n\t\t\ta: 0,1,-3,0,2,-4,0,3,-2,1,3,-3\n\t\t}\n\t}\n\tModel: 2, "Model::Pet", "Mesh" {\n\t\tVersion: 232\n\t}\n}\nConnections:  {\n\tC: "OO",1,2\n\tC: "OO",2,0\n}\n');
}

interface BinaryNode { name: string; properties?: Buffer[]; children?: BinaryNode[]; }
export function createBinaryFbx(compressed = true): Buffer {
  const stringProperty = (value: string) => { const data = Buffer.from(value); const header = Buffer.alloc(5); header[0] = 83; header.writeUInt32LE(data.length, 1); return Buffer.concat([header, data]); };
  const idProperty = (value: number) => { const data = Buffer.alloc(9); data[0] = 76; data.writeBigInt64LE(BigInt(value), 1); return data; };
  const arrayProperty = (values: number[], kind: 'd' | 'i') => {
    const raw = kind === 'd' ? Buffer.from(new Float64Array(values).buffer) : Buffer.from(new Int32Array(values).buffer);
    const data = compressed ? deflateSync(raw) : raw;
    const header = Buffer.alloc(13); header[0] = kind.charCodeAt(0); header.writeUInt32LE(values.length, 1); header.writeUInt32LE(compressed ? 1 : 0, 5); header.writeUInt32LE(data.length, 9);
    return Buffer.concat([header, data]);
  };
  function nodeBytes(node: BinaryNode, start: number): Buffer {
    const name = Buffer.from(node.name);
    const properties = Buffer.concat(node.properties ?? []);
    const children: Buffer[] = [];
    let cursor = start + 13 + name.length + properties.length;
    for (const child of node.children ?? []) { const encoded = nodeBytes(child, cursor); children.push(encoded); cursor += encoded.length; }
    if (children.length) { children.push(Buffer.alloc(13)); cursor += 13; }
    const header = Buffer.alloc(13); header.writeUInt32LE(cursor, 0); header.writeUInt32LE(node.properties?.length ?? 0, 4); header.writeUInt32LE(properties.length, 8); header[12] = name.length;
    return Buffer.concat([header, name, properties, ...children]);
  }
  const tree: BinaryNode[] = [{ name: 'Objects', children: [
    { name: 'Geometry', properties: [idProperty(1), stringProperty('Geometry::Pet'), stringProperty('Mesh')], children: [
      { name: 'Vertices', properties: [arrayProperty([0, 1, 0, -1, -1, 1, 1, -1, 1, 0, -1, -1], 'd')] },
      { name: 'PolygonVertexIndex', properties: [arrayProperty([0, 1, -3, 0, 2, -4, 0, 3, -2, 1, 3, -3], 'i')] }] },
    { name: 'Model', properties: [idProperty(2), stringProperty('Model::Pet'), stringProperty('Mesh')] }] },
  { name: 'Connections', children: [{ name: 'C', properties: [stringProperty('OO'), idProperty(1), idProperty(2)] }, { name: 'C', properties: [stringProperty('OO'), idProperty(2), idProperty(0)] }] }];
  const header = Buffer.alloc(27); header.write('Kaydara FBX Binary  '); header[21] = 26; header.writeUInt32LE(7400, 23);
  const chunks: Buffer[] = [header]; let cursor = 27;
  for (const node of tree) { const encoded = nodeBytes(node, cursor); chunks.push(encoded); cursor += encoded.length; }
  chunks.push(Buffer.alloc(176));
  return Buffer.concat(chunks);
}
