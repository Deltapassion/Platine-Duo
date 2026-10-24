Platine Duo

Logiciel de mix DJ libre — Free DJ mixing software
Windows · Linux · navigateur (Chrome, Edge, Opera)



Créé par Jacques Branas, alias DJ LATIN JAZZ, en collaboration avec Claude.ai (Anthropic).
Logiciel libre sous licence GNU GPL version 2 ou ultérieure. Contact : deltapassion@gmx.com

English below.



Ce que fait Platine Duo





Deux platines avec formes d'onde, BPM, SYNC, 8 repères, boucles, effets (écho, flanger, réverb), jog et pitch.



Table de mixage : gain, égaliseur 3 bandes, filtre, pré-écoute au casque, crossfader, XF START.



Auto DJ : le robot enchaîne les titres d'une platine à l'autre en respectant vos faders.



Sampleur à 8 pads : alarme, police, cloche, sirène… et vos propres sons.



Contrôleurs MIDI, USB HID et Bluetooth MIDI, reconnus au branchement. Intégrés : Gemini GMX (écrans et compteurs compris), Hercules Inpulse 200 et 500, Pioneer DDJ-FLX4 et DDJ-400, Reloop Terminal Mix 2/4. Les mappings Mixxx s'importent tels quels.



Sources : vos fichiers, Audius et Jamendo (titres complets), Deezer (extraits de 30 s).



6 langues : français, English, español, Deutsch, italiano, português. Thèmes, couleur de fond et contraste réglables.



Télécharger

Les fichiers sont dans la rubrique Releases (à droite sur cette page).







Système



Fichier



Installation





Windows 10 / 11



Platine-Duo-Setup-1.1.0.exe



Double-clic. Si Windows affiche « Windows a protégé votre ordinateur », cliquez Informations complémentaires › Exécuter quand même (l'installateur n'est pas signé par un certificat payant).





Ubuntu, Debian, Mint



platine-duo_1.1.0_amd64.deb



sudo apt install ./platine-duo_1.1.0_amd64.deb





Toute distribution Linux



Platine-Duo-1.1.0-x86_64.AppImage



chmod +x Platine-Duo-1.1.0-x86_64.AppImage puis double-clic. Pour un contrôleur en USB HID (écrans du GMX), installez une fois les règles d'accès : voir plus bas.





Navigateur



platine-duo.html



Ouvrir dans Chrome, Edge ou Opera sur ordinateur.

Avant de lancer Platine Duo, fermez Mixxx : un contrôleur ne peut servir qu'à un logiciel à la fois.

Règles d'accès USB pour Linux (AppImage ou sources)

Le paquet .deb les installe tout seul. Avec l'AppImage ou depuis les sources :

sudo cp build/linux/69-platine-duo-usb.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules

Puis débranchez et rebranchez le contrôleur.

Compiler depuis les sources

Il faut Node.js 20 ou plus récent.

npm install                # Electron et les outils de construction
npm start                  # lancer sans installer
npm run dist:linux         # paquet .deb      → dist/
npm run dist:appimage      # AppImage         → dist/
npm run dist:win           # installateur Windows (NSIS requis : sudo apt install nsis)







Élément



Rôle





app/index.html



le logiciel complet (interface, moteur audio, mappings, traductions) ; fonctionne aussi seul dans un navigateur





main.js, preload.js



l'application de bureau (Electron) et son pont sécurisé avec la page





installer.nsi, afterPack.js



l'installateur Windows et l'icône de l'exécutable





build/



icônes, règles USB pour Linux, scripts du paquet .deb





mappings/



mappings d'origine (Gemini GMX v2.1, projet Mixxx)

Signaler un problème

Ouvrez un ticket dans l'onglet Issues, ou écrivez à deltapassion@gmx.com. Indiquez votre système, votre contrôleur et ce qui s'est passé.



English

Platine Duo is a free two-deck DJ mixing program for Windows, Linux and web browsers (Chrome, Edge, Opera).







Two decks with waveforms, BPM, sync, 8 hot cues, loops, effects, jog and pitch.



Mixer with 3-band EQ, filter, headphone cue, crossfader and XF START (crossfader starts the deck).



Auto DJ robot that alternates decks and respects your channel faders.



8-pad sampler with built-in sounds and your own files.



MIDI, USB HID and Bluetooth MIDI controllers, detected when plugged in: Gemini GMX (with its screens and counters), Hercules Inpulse 200/500, Pioneer DDJ-FLX4/DDJ-400, Reloop Terminal Mix 2/4. Mixxx mappings can be imported as they are.



Sources: local files, Audius and Jamendo (full tracks), Deezer (30-second previews).



Interface in 6 languages, with themes, background colour and contrast settings.

Download the Windows installer, the .deb package, the AppImage or the HTML file from Releases. Close Mixxx before starting Platine Duo. To build from source, see the commands above (npm install, npm start, npm run dist:linux).

Created by Jacques Branas (DJ LATIN JAZZ) in collaboration with Claude.ai (Anthropic). Licensed under the GNU GPL v2 or later. Contact: deltapassion@gmx.com



Sécurité / Security





La page tourne dans un bac à sable, sans accès au système, isolée du reste de l'application.



Aucun script ne peut être chargé depuis Internet (politique de contenu CSP).



Le MIDI, l'USB et le Bluetooth ne sont autorisés que pour la page du logiciel.



L'application ne peut lire sur Internet, pour la page, que les adresses de Deezer (liste fermée).



Electron 44.9.3, avec les verrous de sécurité « fuses » activés (pas de mode Node, pas d'inspection).



Un mapping Mixxx importé est un programme : n'importez que des mappings de sources sûres (projet Mixxx,
auteurs connus), comme dans Mixxx.

Remerciements / Credits





Mapping Gemini GMX : mapping HID d'origine et décodage du protocole par Miss (projet
codecat/mixxx-gemini-gmx), version 2.1 par Jacques Branas.



Mappings Hercules Inpulse 200 et 500, Pioneer DDJ-FLX4 et DDJ-400, Reloop Terminal Mix 2/4,
bibliothèques common-controller-scripts.js et midi-components-0.0.js, règles udev : projet Mixxx
(https://mixxx.org), GNU GPL v2 ou ultérieure.



Polices Saira, Saira Condensed et JetBrains Mono : SIL Open Font License.



Electron : licence MIT.
