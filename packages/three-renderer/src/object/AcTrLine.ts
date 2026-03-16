import { AcGePoint3dLike, AcGiSubEntityTraits } from '@mlightcad/data-model'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

import { AcTrStyleManager } from '../style/AcTrStyleManager'
import { AcTrBufferGeometryUtil, AcTrMaterialUtil } from '../util'
import { AcTrEntity } from './AcTrEntity'

export class AcTrLine extends AcTrEntity {
  public geometry: THREE.BufferGeometry | LineSegmentsGeometry
  private _originalColor: number
  private _traits: AcGiSubEntityTraits

  constructor(
    points: AcGePoint3dLike[],
    traits: AcGiSubEntityTraits,
    styleManager: AcTrStyleManager,
    backgroundColor?: number
  ) {
    super(styleManager)
    this._originalColor = traits.rgbColor
    this._traits = traits

    // Invert color if it matches background (white-on-white or black-on-black)
    if (backgroundColor !== undefined) {
      const color = traits.color.RGB ?? 0xffffff
      if (color === backgroundColor && (color === 0xffffff || color === 0x000000)) {
        traits.color.setRGBValue(color === 0xffffff ? 0x000000 : 0xffffff)
      }
    }

    const material = this.styleManager.getLineMaterial(traits)
    const maxVertexCount = points.length

    if (material instanceof LineMaterial) {
      const segmentPositions = new Float32Array((maxVertexCount - 1) * 6)
      const box = new THREE.Box3()
      for (let i = 0; i < maxVertexCount; i++) {
        const point = points[i]
        box.expandByPoint(_point1.set(point.x, point.y, point.z ?? 0))
      }
      for (let i = 0, pos = 0; i < maxVertexCount - 1; i++) {
        const p1 = points[i]
        const p2 = points[i + 1]
        segmentPositions[pos++] = p1.x
        segmentPositions[pos++] = p1.y
        segmentPositions[pos++] = p1.z ?? 0
        segmentPositions[pos++] = p2.x
        segmentPositions[pos++] = p2.y
        segmentPositions[pos++] = p2.z ?? 0
      }

      const lineGeometry = new LineSegmentsGeometry()
      lineGeometry.setPositions(segmentPositions)
      lineGeometry.computeBoundingBox()
      lineGeometry.computeBoundingSphere()
      this.geometry = lineGeometry
      this.box.copy(box)

      const line = new LineSegments2(lineGeometry, material)
      line.userData.styleMaterialId = material.id
      this.add(line)
      return
    }

    const vertices = new Float32Array(maxVertexCount * 3)
    const indices =
      maxVertexCount * 2 > 65535
        ? new Uint32Array(maxVertexCount * 2)
        : new Uint16Array(maxVertexCount * 2)

    for (let i = 0, pos = 0; i < maxVertexCount; i++) {
      const point = points[i]
      vertices[pos++] = point.x
      vertices[pos++] = point.y
      vertices[pos++] = point.z ?? 0
    }
    for (let i = 0, pos = 0; i < maxVertexCount - 1; i++) {
      indices[pos++] = i
      indices[pos++] = i + 1
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    this.setBoundingBox(geometry)

    this.geometry = geometry
    const line = new THREE.LineSegments(geometry, material)
    AcTrBufferGeometryUtil.computeLineDistances(line)
    this.add(line)
  }

  private setBoundingBox(geometry: THREE.BufferGeometry) {
    geometry.computeBoundingBox()
    this.box = geometry.boundingBox!
  }

  updateColorForBackground(backgroundColor: number): void {
    // Calculate what the color should be based on background
    const shouldInvert =
      (this._originalColor === 0xffffff && backgroundColor === 0xffffff) ||
      (this._originalColor === 0x000000 && backgroundColor === 0x000000)

    const finalColor = shouldInvert
      ? (this._originalColor === 0xffffff ? 0x000000 : 0xffffff)
      : this._originalColor

    if (shouldInvert) {
      // console.log('traits', this._traits)
      const mat = this.styleManager.getLineMaterial(this._traits)
      AcTrMaterialUtil.setMaterialColor(mat, new THREE.Color(finalColor))

      if (mat instanceof LineMaterial)
        mat.color.setHex(finalColor)
    }

    // Note: After flattening, this AcTrLine container may have no children
    // (children moved to parent). In that case, this method won't update anything.
    // The caller should either call this before flattening, or call updateMaterial
    // on the parent container with the actual LineSegments children.

    // Update all material colors in the line children
    // this.traverse((object: THREE.Object3D) => {
    //   console.log('Traversing AcTrLine object for color update:', object)
    //   if ('material' in object && object.material) {
    //     const material = object.material as THREE.Material | THREE.Material[]

    //     // Handle both single material and material arrays
    //     const materials = Array.isArray(material) ? material : [material]

    //     materials.forEach((mat: THREE.Material) => {
    //       // Handle LineMaterial from three/examples (has .color property)
    //       if (mat instanceof LineMaterial) {
    //         mat.color.setHex(finalColor)
    //       } else {
    //         // Handle other standard materials
    //         AcTrMaterialUtil.setMaterialColor(mat, new THREE.Color(finalColor))
    //       }
    //     })
    //   }
    // })
  }
}

const _point1 = /*@__PURE__*/ new THREE.Vector3()
