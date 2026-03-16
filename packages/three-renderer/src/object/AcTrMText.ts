import {
  AcGiMTextData,
  AcGiSubEntityTraits,
  AcGiTextStyle,
  log
} from '@mlightcad/data-model'
import { MTextObject } from '@mlightcad/mtext-renderer'
import * as THREE from 'three'

import { AcTrMTextRenderer } from '../renderer'
import { AcTrStyleManager } from '../style/AcTrStyleManager'
import { AcTrMaterialUtil } from '../util/AcTrMaterialUtil'
import { AcTrEntity } from './AcTrEntity'

export class AcTrMText extends AcTrEntity {
  private _mtext?: MTextObject
  private _text: AcGiMTextData
  private _style: AcGiTextStyle & {
    color: number
    isByLayer: boolean
    layer: string
    byLayerColor?: number
    byBlockColor?: number
  }
  private _originalColor: number

  constructor(
    text: AcGiMTextData,
    traits: AcGiSubEntityTraits,
    style: AcGiTextStyle,
    styleManager: AcTrStyleManager,
    delay: boolean = false
  ) {
    super(styleManager)
    this._text = text
    this._originalColor = traits.rgbColor

    this._style = {
      ...style,
      color: traits.rgbColor,
      isByLayer: traits.color.isByLayer,
      layer: traits.layer
    }
    if (!delay) {
      this.syncDraw()
    }
  }

  async syncDraw() {
    const mtextRenderer = AcTrMTextRenderer.getInstance()
    if (!mtextRenderer) return

    try {
      const style = this._style

      // @ts-expect-error AcGiTextData and MTextData are compatible
      this._mtext = mtextRenderer.syncRenderMText(this._text, style, {
        byLayerColor: style.byLayerColor,
        byBlockColor: style.byBlockColor
      })
      this.add(this._mtext)
      this.flatten()
      this.traverse(object => {
        // Add the flag to check intersection using bounding box of the mesh
        object.userData.bboxIntersectionCheck = true
      })
      this.box = this._mtext.box
    } catch (error) {
      log.info(
        `Failed to render mtext '${this._text.text}' with the following error:\n`,
        error
      )
    }
  }

  async draw() {
    const mtextRenderer = AcTrMTextRenderer.getInstance()
    if (!mtextRenderer) return

    try {
      const style = this._style

      // @ts-expect-error AcGiTextData and MTextData are compatible
      this._mtext = await mtextRenderer.asyncRenderMText(this._text, style, {
        byLayerColor: style.byLayerColor,
        byBlockColor: style.byBlockColor
      })
        .then(mtext => {
          this._mtext = mtext
          this.add(this._mtext)
          this.flatten()
          this.traverse(object => {
            // Add the flag to check intersection using bounding box of the mesh
            object.userData.bboxIntersectionCheck = true
          })
          this.box = this._mtext.box
        })
    } catch (error) {
      log.info(
        `Failed to render mtext '${this._text.text}' with the following error:\n`,
        error
      )
    }
  }

  /**
   * Get intersections between a casted ray and this object. Override this method
   * to calculate intersection using the bounding box of texts.
   */
  raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    this._mtext?.raycast(raycaster, intersects)
  }

  /**
   * Updates text color dynamically when background changes.
   * This updates the materials directly without recreating the text geometry.
   */
  updateColorForBackground(backgroundColor: number): void {
    // console.log('Updating text color for background color:', backgroundColor)
    // Calculate what the color should be based on background
    const shouldInvert =
      (this._originalColor === 0xffffff && backgroundColor === 0xffffff) ||
      (this._originalColor === 0x000000 && backgroundColor === 0x000000)

    const finalColor = shouldInvert
      ? (this._originalColor === 0xffffff ? 0x000000 : 0xffffff)
      : this._originalColor

    // Update the style color
    this._style.color = finalColor

    // console.log('Final text color after update:', finalColor, shouldInvert, this._originalColor, this._style)

    // Update all material colors in the text children
    this.traverse((object: THREE.Object3D) => {
      // console.log('Traversing AcTrMText object for color update:', object)
      if ('material' in object && object.material) {
        const material = object.material as THREE.Material | THREE.Material[]

        // Handle both single material and material arrays
        const materials = Array.isArray(material) ? material : [material]

        materials.forEach((mat: THREE.Material) => {
          AcTrMaterialUtil.setMaterialColor(mat, new THREE.Color(finalColor))
          // Update color property if it exists (MeshBasicMaterial, etc.)
          // if ('color' in mat && mat.color instanceof THREE.Color) {
          //   mat.color.setHex(finalColor)
          // }

          // // Update uniforms if it's a shader material
          // if ('uniforms' in mat && mat.uniforms && typeof mat.uniforms === 'object') {
          //   const uniforms = mat.uniforms as Record<string, unknown>
          //   if ('u_color' in uniforms && uniforms.u_color && typeof uniforms.u_color === 'object' && 'value' in uniforms.u_color) {
          //     const colorUniform = uniforms.u_color as { value: THREE.Color }
          //     if (colorUniform.value instanceof THREE.Color) {
          //       colorUniform.value.setHex(finalColor)
          //     }
          //   }
          // }
        })
      }
    })
  }
}

