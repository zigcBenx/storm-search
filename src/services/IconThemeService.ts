
import path from 'path';
import fs from 'fs';
import * as vscode from 'vscode';
import { Font, ResolvedIconDefinition } from '../types';


export class IconThemeService {
  private extensionToLangId: Map<string, string> = new Map();
  private langIdToExtensions: Map<string, string[]> = new Map();

  private iconThemeId: string | undefined;

  private iconThemeExtension: vscode.Extension<any> | undefined;
  private iconTheme: any | undefined;
  private iconThemePath: string | undefined;

  private themeJson: any = {};

  constructor() {
    const config = vscode.workspace.getConfiguration("workbench")
    this.iconThemeId = config.get<string>("iconTheme")

    for (const ext of vscode.extensions.all) {
      const contributes = ext.packageJSON.contributes
      if (contributes?.iconThemes) {
        const theme = contributes.iconThemes.find((t: any) => t.id === this.iconThemeId)
        if (theme) {
          this.iconThemeExtension = ext
          this.iconTheme = theme
        }
      }

      const langs = ext.packageJSON?.contributes?.languages || []
      for (const lang of langs) {
        const extensions = lang.extensions || []
        const langId = lang.id
        if (!this.langIdToExtensions.has(langId)) {
          this.langIdToExtensions.set(langId, [])
        }
        for (const fileExt of extensions) {
          const cleanExt = fileExt.startsWith(".") ? fileExt.slice(1) : fileExt
          this.extensionToLangId.set(cleanExt, langId)
          this.langIdToExtensions.get(langId)!.push(cleanExt)
        }
      }

      if (this.iconThemeExtension && this.iconTheme) {
        this.iconThemePath = path.resolve(this.iconThemeExtension.extensionPath, this.iconTheme.path)
        this.themeJson = JSON.parse(fs.readFileSync(this.iconThemePath, "utf-8"))
      }
    }
  }

  getIconThemeExtension(): vscode.Extension<any> | undefined {
    return this.iconThemeExtension;
  }

  getIconFonts(): Font[] {
    const fonts: Font[] = []

    console.log(this.themeJson)
    for (const font of this.themeJson.fonts || []) {
      const fontId = font.id
      const fontSrcs = font.src || []
      if (fontSrcs.length === 0) {
        continue;
      }
      const src = fontSrcs[0]
      const themeDir = this.iconThemePath ? path.dirname(this.iconThemePath) : ""
      const absPath = path.isAbsolute(src.path) ? src.path : path.resolve(themeDir, src.path)
      fonts.push({
        fontId,
        fontFormat: src.format || "truetype",
        fontUri: vscode.Uri.file(absPath),
        fontWeight: font.fontWeight,
        fontStyle: font.fontStyle,
        fontSize: font.fontSize,
      })

    }
    return fonts
  }

  getIconForPath(filePath: string): ResolvedIconDefinition | null {
    const fileName = path.basename(filePath)
    // Naive check
    const isFile = fileName.includes('.')
    if (isFile) {
      return this.getIconForFileName(fileName)
    } else {
      return this.getIconForFolder(fileName)
    }
  }

  private getIconForFolder(folderName: string): ResolvedIconDefinition | null {
    const iconName = this.themeJson.folderNames?.[folderName] || this.themeJson.folder || "_folder"

    const def = this.themeJson.iconDefinitions?.[iconName]
    return this.resolveIconDefinition(def);
  }

  private getIconForFileName(fileName: string): ResolvedIconDefinition | null {
    // Look up icon name from fileName
    const fileExtension = path.extname(fileName).replace(/^\./, "")
    let iconName: string | undefined

    // Filename > Extension > Language > Default
    if (fileName.includes(".")) {
      // Looks like a full filename, search json for a match
      iconName = this.themeJson.fileNames?.[fileName]
    }
    if (!iconName) {
      // Search for a full file names like "index.ts"
      iconName = this.themeJson.fileExtensions?.[fileName]
      if (!iconName) {
        // Search for a lang file extension for strings like "ts"
        iconName = this.themeJson.fileExtensions?.[fileExtension]
      }
    }
    if (!iconName) {
      // Search for a lang id from a map
      const langId = this.extensionToLangId.get(fileName) || this.extensionToLangId.get(fileExtension)
      if (langId) {
        iconName = this.themeJson.languageIds?.[langId]
      }
    }

    if (!iconName) {
      // Default file icon in case none been found
      iconName = this.themeJson.file || "_file"
    }

    // Get icon definition
    const def = this.themeJson.iconDefinitions?.[iconName!]

    return this.resolveIconDefinition(def);
  }

  private resolveIconDefinition(iconDefinition: any): ResolvedIconDefinition | null {
    if (!iconDefinition) {
      return null;
    }

    const isFont = !!iconDefinition.fontCharacter
    if (isFont) {
      return {
        fontCharacter: iconDefinition.fontCharacter,
        fontColor: iconDefinition.fontColor,
        fontSize: iconDefinition.fontSize,
        fontId: iconDefinition.fontId || this.themeJson.fonts?.[0]?.id,
      }
    }

    const iconPath = iconDefinition.iconPath
    if (!iconPath) {
      return null;
    }

    let svgRelPath = ""
    if (typeof iconPath === "string") {
      svgRelPath = iconPath
    } else if (typeof iconPath === "object") {
      // Icon themes rarely have icons specific to theme kind, but they still may, so it’s safer to check for that
      const themeKind = vscode.window.activeColorTheme.kind
      if (themeKind === vscode.ColorThemeKind.HighContrast) {
        svgRelPath = iconPath.highContrast || iconPath.dark || iconPath.light || ""
      } else if (themeKind === vscode.ColorThemeKind.HighContrastLight) {
        svgRelPath = iconPath.highContrastLight || iconPath.light || iconPath.dark || ""
      } else if (themeKind === vscode.ColorThemeKind.Light) {
        svgRelPath = iconPath.light || iconPath.dark || ""
      } else {
        svgRelPath = iconPath.dark || iconPath.light || ""
      }
    }

    // For svgs resolve them to webview URI from an abs path
    const themeDir = this.iconThemePath ? path.dirname(this.iconThemePath) : ""
    const absPath = path.isAbsolute(svgRelPath) ? svgRelPath : path.resolve(themeDir, svgRelPath)
    return { svgPath: absPath }
  }
}
