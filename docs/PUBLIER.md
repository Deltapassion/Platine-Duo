# Publier une nouvelle version sur GitHub

Exemple : Platine DUO 3.0.0, sur le dépôt https://github.com/Deltapassion/Platine-Duo

## 1. Mettre à jour le code

1. Décompressez `platine-duo-depot.zip` sur votre ordinateur.
2. Sur la page du dépôt : **Add file › Upload files**.
3. Sélectionnez **tout le contenu** du dossier décompressé (pas le dossier lui-même) et glissez-le dans la page.
   Les fichiers de même nom sont remplacés, les nouveaux sont ajoutés.
   Sous Windows, cochez Affichage › « Éléments masqués » pour voir le fichier caché `.gitignore`.
4. En bas : message `Platine DUO 3.0.0` › **Commit changes**.

Le code ne contient aucun fichier de plus de 25 Mo : les gros fichiers vont dans la Release.

## 2. Publier les fichiers à télécharger (Release)

1. Colonne de droite : **Releases** › **Draft a new release**
   (ou l'adresse `…/releases/new` du dépôt).
2. **Choose a tag** : tapez `Version_3_0_0` (exactement, c'est le nom utilisé par les liens du site) › **Create new tag**.
3. Titre : `Platine DUO 3.0.0`.
4. Description, par exemple :
   `Nouveau : le mode timeline devient TIMELINE DJ MIX (par DJ LATIN JAZZ & DJ CRISLATINO) avec effets écho, flanger et réverb ; contrôleurs reconnus et mappings chargés tout seuls au branchement (22 inclus) ; carte son branchée après le démarrage prise en compte ; 10 langues ; Platine DUO propose maintenant d'installer les nouvelles versions. Windows : .exe · Mac : .zip (arm64 = Apple Silicon, x64 = Intel) · Ubuntu/Debian : .deb · toutes distributions Linux : AppImage · navigateur : .html. Les réglages des versions précédentes sont conservés.`
5. Glissez dans la zone « Attach binaries » :
   - `Platine-DUO-Setup-3.0.0.exe`
   - `platine-duo_3.0.0_amd64.deb`
   - `Platine-DUO-3.0.0-x86_64.AppImage`
   - `Platine-DUO-3.0.0-mac-arm64.zip`
   - `Platine-DUO-3.0.0-mac-x64.zip`
   - `platine-duo.html`
   Attention : si votre navigateur a renommé un fichier en « (1) », « (2) »… (téléchargé deux fois), renommez-le avant de l'envoyer, sinon le lien du site donne une erreur 404.
6. Attendez la fin de chaque chargement, cochez **Set as the latest release**, puis **Publish release**.

Les Releases précédentes (2.3.0, 2.2.0, 2.1.0, 2.0.0, 1.1.0) restent disponibles en dessous. Le compteur du site additionne les téléchargements
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

Les boutons de téléchargement pointent vers la Release `Version_3_0_0`. Les fichiers de cette Release doivent
porter exactement ces noms : `Platine-DUO-Setup-3.0.0.exe`, `Platine-DUO-3.0.0-mac-arm64.zip`,
`Platine-DUO-3.0.0-mac-x64.zip`, `platine-duo_3.0.0_amd64.deb`, `Platine-DUO-3.0.0-x86_64.AppImage`,
`platine-duo.html`. Pour changer un nom, modifiez le lien correspondant dans `docs/index.html`.

## Mises à jour proposées par le logiciel

Depuis la 3.0.0, Platine DUO regarde au démarrage la dernière Release du dépôt (celle marquée **Latest**) et, si son étiquette
(`Version_X_Y_Z`) est plus récente, propose de l'installer. Pour que cela marche avec les prochaines versions :
gardez la forme d'étiquette `Version_X_Y_Z`, cochez **Set as the latest release**, et gardez les mêmes formes de noms de fichiers
(`Platine-DUO-Setup-X.Y.Z.exe`, `platine-duo_X.Y.Z_amd64.deb`, `Platine-DUO-X.Y.Z-x86_64.AppImage`, `Platine-DUO-X.Y.Z-mac-arm64.zip`,
`Platine-DUO-X.Y.Z-mac-x64.zip`, `platine-duo.html`).
