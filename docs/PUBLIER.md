# Publier une nouvelle version sur GitHub

Exemple : Platine DUO 2.1.0, sur le dépôt https://github.com/Deltapassion/Platine-Duo

## 1. Mettre à jour le code

1. Décompressez `platine-duo-depot.zip` sur votre ordinateur.
2. Sur la page du dépôt : **Add file › Upload files**.
3. Sélectionnez **tout le contenu** du dossier décompressé (pas le dossier lui-même) et glissez-le dans la page.
   Les fichiers de même nom sont remplacés, les nouveaux sont ajoutés.
   Sous Windows, cochez Affichage › « Éléments masqués » pour voir le fichier caché `.gitignore`.
4. En bas : message `Platine DUO 2.1.0` › **Commit changes**.

Le code ne contient aucun fichier de plus de 25 Mo : les gros fichiers vont dans la Release.

## 2. Publier les fichiers à télécharger (Release)

1. Colonne de droite : **Releases** › **Draft a new release**
   (ou l'adresse `…/releases/new` du dépôt).
2. **Choose a tag** : tapez `Version_2_1_0` (exactement, c'est le nom utilisé par les liens du site) › **Create new tag**.
3. Titre : `Platine DUO 2.1.0`.
4. Description, par exemple :
   `Nouveau : mode timeline façon MixMeister (blocs sur des pistes, courbes de volume, construction depuis l'Auto DJ, export WAV et MP3). Le logiciel s'appelle désormais Platine DUO. Windows : .exe · Mac : .zip (arm64 = Apple Silicon, x64 = Intel) · Ubuntu/Debian : .deb · toutes distributions Linux : AppImage · navigateur : .html. Les réglages des versions précédentes sont conservés.`
5. Glissez dans la zone « Attach binaries » :
   - `Platine-DUO-Setup-2.1.0.exe`
   - `platine-duo_2.1.0_amd64.deb`
   - `Platine-DUO-2.1.0-x86_64.AppImage`
   - `Platine-DUO-2.1.0-mac-arm64.zip`
   - `Platine-DUO-2.1.0-mac-x64.zip`
   - `platine-duo.html`
6. Attendez la fin de chaque chargement, cochez **Set as the latest release**, puis **Publish release**.

Les Releases 2.0.0 et 1.1.0 restent disponibles en dessous. Le compteur du site additionne les téléchargements
de toutes les versions 2.x (le mapping GMX est compté à part).

## 3. Faire connaître

- **Flathub n'est pas possible** : depuis mai 2026, Flathub refuse les logiciels écrits avec l'aide d'une IA.
- **AppImage** : vous pouvez l'inscrire sur https://www.appimagehub.com.
- **Forums** : forum Mixxx (https://mixxx.discourse.group), r/DJs et r/linuxaudio sur Reddit, forum ubuntu-fr.org. Indiquez honnêtement que le logiciel a été créé avec l'aide de Claude.ai.

## Le site internet (GitHub Pages)

Le site est dans le dossier `docs/` : `index.html` (la page), `assets/` (photo de fond, logo, captures),
`app/` (la version navigateur, jouable en ligne) et les notices.

1. Envoyez le dossier `docs/` complet sur le dépôt (Add file › Upload files, en gardant les sous-dossiers).
2. Sur le dépôt : **Settings › Pages**.
3. *Source* : **Deploy from a branch** ; *Branch* : **main**, dossier **/docs** ; **Save**.
4. Après une à deux minutes, le site est en ligne à l'adresse : https://deltapassion.github.io/Platine-Duo/

Les boutons de téléchargement pointent vers la Release `Version_2_1_0`. Les fichiers de cette Release doivent
porter exactement ces noms : `Platine-DUO-Setup-2.1.0.exe`, `Platine-DUO-2.1.0-mac-arm64.zip`,
`Platine-DUO-2.1.0-mac-x64.zip`, `platine-duo_2.1.0_amd64.deb`, `Platine-DUO-2.1.0-x86_64.AppImage`,
`platine-duo.html`. Pour changer un nom, modifiez le lien correspondant dans `docs/index.html`.
