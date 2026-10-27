# Publier une nouvelle version sur GitHub

Exemple : Platine Duo 4V 2.0.0, sur le dépôt déjà créé
https://github.com/Deltapassion/platine-duo.-Free-DJ-mixing-software-

## 1. Mettre à jour le code

1. Décompressez `platine-duo-4v-depot.zip` sur votre ordinateur.
2. Sur la page du dépôt : **Add file › Upload files**.
3. Sélectionnez **tout le contenu** du dossier décompressé (pas le dossier lui-même) et glissez-le dans la page.
   Les fichiers de même nom sont remplacés, les nouveaux sont ajoutés.
   Sous Windows, cochez Affichage › « Éléments masqués » pour voir le fichier caché `.gitignore`.
4. En bas : message `Platine Duo 4V 2.0.0` › **Commit changes**.

Le code ne contient aucun fichier de plus de 25 Mo : les gros fichiers vont dans la Release.

## 2. Publier les fichiers à télécharger (Release)

1. Colonne de droite : **Releases** › **Draft a new release**
   (ou l'adresse `…/releases/new` du dépôt).
2. **Choose a tag** : tapez `v2.0.0` › **Create new tag**.
3. Titre : `Platine Duo 4V 2.0.0`.
4. Description, par exemple :
   `Nouveau : mode 4 voies (platines C et D), mapping Reloop Beatpad. Windows : .exe · Mac : .zip (arm64 = Apple Silicon, x64 = Intel) · Ubuntu/Debian : .deb · toutes distributions Linux : AppImage · navigateur : .html. Les réglages de la version 1.1.0 sont conservés.`
5. Glissez dans la zone « Attach binaries » :
   - `Platine-Duo-4V-Setup-2.0.0.3.exe`
   - `platine-duo_2.0.0_amd64.3.deb`
   - `Platine-Duo-4V-2.0.0-x86_64.3.AppImage`
   - `Platine-Duo-4V-2.0.0-mac-arm64.zip`
   - `Platine-Duo-4V-2.0.0-mac-x64.zip`
   - `platine-duo-4v.html`
   - `Gemini-GMX-v2.1-Mixxx.zip`
6. Attendez la fin de chaque chargement, cochez **Set as the latest release**, puis **Publish release**.

La Release 1.1.0 reste disponible juste en dessous, pour qui en aurait besoin.

## 3. Faire connaître

- **Flathub n'est pas possible** : depuis mai 2026, Flathub refuse les logiciels écrits avec l'aide d'une IA.
- **AppImage** : vous pouvez l'inscrire sur https://www.appimagehub.com.
- **Forums** : forum Mixxx (https://mixxx.discourse.group), r/DJs et r/linuxaudio sur Reddit, forum ubuntu-fr.org. Indiquez honnêtement que le logiciel a été créé avec l'aide de Claude.ai.

## Le site internet (GitHub Pages)

Le site est dans le dossier `docs/` : `index.html` (la page), `assets/` (photo de fond, logo, captures),
`app/` (la version navigateur, jouable en ligne) et les deux notices.

1. Envoyez le dossier `docs/` complet sur le dépôt (Add file › Upload files, en gardant les sous-dossiers).
2. Sur le dépôt : **Settings › Pages**.
3. *Source* : **Deploy from a branch** ; *Branch* : **main**, dossier **/docs** ; **Save**.
4. Après une à deux minutes, le site est en ligne à l'adresse : https://deltapassion.github.io/Platine-Duo/

Les boutons de téléchargement pointent vers la Release `Version_2_0_0`. Les fichiers de cette Release doivent
porter exactement ces noms : `Platine-Duo-4V-Setup-2.0.0.3.exe`, `Platine-Duo-4V-2.0.0-mac-arm64.zip`,
`Platine-Duo-4V-2.0.0-mac-x64.zip`, `platine-duo_2.0.0_amd64.3.deb`, `Platine-Duo-4V-2.0.0-x86_64.3.AppImage`,
`platine-duo-4v.html`. Pour changer un nom, modifiez le lien correspondant dans `docs/index.html`.
