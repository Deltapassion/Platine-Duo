; Installateur Windows de Platine DUO
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "Platine DUO"
!define EXENAME "Platine DUO.exe"
!define VERSION "2.1.0"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\PlatineDuo"

Name "${APPNAME}"
OutFile "dist\Platine-DUO-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\PlatineDuo" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"

VIProductVersion "2.1.0.0"
VIAddVersionKey /LANG=1036 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1036 "FileDescription" "Installation de ${APPNAME}"
VIAddVersionKey /LANG=1036 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1036 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1036 "CompanyName" "Jacques Branas"
VIAddVersionKey /LANG=1036 "LegalCopyright" "© 2026 Jacques Branas, en collaboration avec Claude.ai — GNU GPL v2+"

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Installation de ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Platine DUO, par DJ LATIN JAZZ (Jacques Branas) en collaboration avec Claude.ai, est un logiciel de mix à deux ou quatre platines, avec timeline, Auto DJ, sampleur et prise en charge des contrôleurs MIDI et USB HID (Gemini GMX, Reloop Beatpad, Hercules, Pioneer...).$\r$\n$\r$\nSi une version précédente de Platine Duo est installée, elle sera remplacée : vos réglages, mappings et sons du sampleur sont conservés.$\r$\n$\r$\nFermez Mixxx avant de lancer Platine Duo : un contrôleur ne peut être utilisé que par un seul logiciel à la fois.$\r$\n$\r$\nCliquez sur Suivant pour continuer."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${APPNAME}"

!insertmacro MUI_PAGE_WELCOME
!define MUI_LICENSEPAGE_TEXT_TOP "Platine DUO est un logiciel libre, distribué sous licence GNU GPL version 2 ou ultérieure."
!define MUI_LICENSEPAGE_BUTTON "Suivant >"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Vous pouvez utiliser, étudier, modifier et partager ce logiciel. Une version modifiée doit rester sous la même licence. Cliquez sur Suivant pour continuer."
!insertmacro MUI_PAGE_LICENSE "LICENSE-GPL-2.0.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

; ---------------------------------------------------------------------------
; Recherche d'une version déjà installée (par cet installateur ou un plus ancien,
; pour l'utilisateur ou pour tout l'ordinateur, en 64 ou 32 bits)
!define UNROOT "Software\Microsoft\Windows\CurrentVersion\Uninstall"
Var OldUninst
Var OldName
Var OldVer
Var OldDir
Var OldKey
Var OldRoot
Var OldView

!macro SCAN_ROOT ROOT
  Function Scan${ROOT}
    StrCmp $OldUninst "" 0 done
    StrCpy $R0 0
    loop:
      EnumRegKey $R1 ${ROOT} "${UNROOT}" $R0
      StrCmp $R1 "" done
      IntOp $R0 $R0 + 1
      ReadRegStr $R2 ${ROOT} "${UNROOT}\$R1" "DisplayName"
      StrCpy $R3 $R2 11
      StrCmp $R3 "Platine Duo" 0 loop
      ReadRegStr $R4 ${ROOT} "${UNROOT}\$R1" "UninstallString"
      StrCmp $R4 "" loop
      StrCpy $OldUninst $R4
      StrCpy $OldName $R2
      StrCpy $OldKey $R1
      StrCpy $OldRoot "${ROOT}"
      ReadRegStr $OldVer ${ROOT} "${UNROOT}\$R1" "DisplayVersion"
      ReadRegStr $OldDir ${ROOT} "${UNROOT}\$R1" "InstallLocation"
    done:
  FunctionEnd
!macroend
!insertmacro SCAN_ROOT HKCU
!insertmacro SCAN_ROOT HKLM

; la clé de désinstallation existe-t-elle encore ? ($R9 = 1 oui, 0 non)
Function OldStillThere
  StrCpy $R9 0
  StrCmp $OldRoot "HKLM" lm
  ReadRegStr $R8 HKCU "${UNROOT}\$OldKey" "UninstallString"
  Goto test
  lm:
  ReadRegStr $R8 HKLM "${UNROOT}\$OldKey" "UninstallString"
  test:
  StrCmp $R8 "" +2
  StrCpy $R9 1
FunctionEnd

Function .onInit
  StrCpy $OldUninst ""
  SetRegView 64
  StrCpy $OldView 64
  Call ScanHKCU
  Call ScanHKLM
  StrCmp $OldUninst "" 0 found
  SetRegView 32
  StrCpy $OldView 32
  Call ScanHKCU
  Call ScanHKLM
  StrCmp $OldUninst "" none found

  found:
  StrCmp $OldVer "" 0 +2
  StrCpy $OldVer "(version inconnue)"
  StrCmp $OldDir "" 0 +2
  StrCpy $OldDir "dossier inconnu"
  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "$OldName $OldVer est déjà installé sur cet ordinateur$\r$\n($OldDir).$\r$\n$\r$\nOui : le désinstaller d'abord, puis installer ${APPNAME} ${VERSION} (recommandé).$\r$\nNon : installer par-dessus.$\r$\nAnnuler : quitter.$\r$\n$\r$\nVos réglages, thèmes, mappings et sons du sampleur sont conservés." /SD IDYES IDYES remove IDNO none
  Abort

  remove:
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F /T'
  Sleep 1000
  ; sépare le programme de désinstallation de ses paramètres
  StrCpy $R5 $OldUninst
  StrCpy $R6 ""
  StrCpy $R7 $OldUninst 1
  StrCmp $R7 '"' 0 parsed
  StrCpy $R8 1
  qloop:
    StrCpy $R7 $OldUninst 1 $R8
    StrCmp $R7 '"' qend
    StrCmp $R7 "" qend
    IntOp $R8 $R8 + 1
    Goto qloop
  qend:
  IntOp $R9 $R8 - 1
  StrCpy $R5 $OldUninst $R9 1
  IntOp $R8 $R8 + 1
  StrCpy $R6 $OldUninst "" $R8
  parsed:
  IfFileExists "$R5" run
  ; programme de désinstallation introuvable : on retire seulement l'inscription
  StrCmp $OldRoot "HKLM" 0 +3
  DeleteRegKey HKLM "${UNROOT}\$OldKey"
  Goto restore
  DeleteRegKey HKCU "${UNROOT}\$OldKey"
  Goto restore

  run:
  ; ouverture par Windows : demande l'autorisation administrateur si l'ancienne version en a besoin
  ExecShellWait "open" "$R5" "$R6 /S" SW_SHOWNORMAL
  ; le désinstallateur se relance depuis le dossier temporaire : on attend la fin (60 s max.)
  StrCpy $R0 0
  wait:
    Sleep 500
    Call OldStillThere
    StrCmp $R9 0 restore
    IntOp $R0 $R0 + 1
    IntCmp $R0 120 0 wait
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "L'ancienne version n'a pas pu être désinstallée.$\r$\nVous pouvez la retirer depuis Paramètres › Applications, puis relancer cette installation.$\r$\n$\r$\nOK : installer quand même.  Annuler : quitter." /SD IDOK IDOK restore
  Abort

  restore:
  Sleep 500
  none:
  SetRegView default
  ; l'ancien dossier par défaut « Platine Duo » est remplacé par celui de la nouvelle version
  StrCmp $INSTDIR "$LOCALAPPDATA\Programs\Platine Duo" 0 +2
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${APPNAME}"
  StrCmp $INSTDIR "$LOCALAPPDATA\Programs\Platine Duo 4V" 0 +2
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${APPNAME}"
FunctionEnd

Section "Platine DUO" SecMain
  SetShellVarContext current
  ; ferme une instance en cours avant de remplacer les fichiers
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F /T'
  Sleep 1500
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Désinstaller ${APPNAME}.exe"
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Désinstaller ${APPNAME}.lnk" "$INSTDIR\Désinstaller ${APPNAME}.exe"
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  WriteRegStr HKCU "Software\PlatineDuo" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "Jacques Branas"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Désinstaller ${APPNAME}.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F /T'
  Sleep 500
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\PlatineDuo"
  ; les réglages (thème, mappings, repères) restent dans %APPDATA%\platine-duo
SectionEnd
