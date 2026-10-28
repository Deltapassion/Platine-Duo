# Publier Platine Duo sur Google Play

La version Android est déjà en ligne : https://deltapassion.github.io/Platine-Duo/app/
Dans Chrome sur Android : menu ⋮ › « Installer l'application ». Elle s'ouvre en plein écran, fonctionne hors ligne
et reconnaît les contrôleurs MIDI branchés en USB (câble OTG).

Pour la mettre aussi sur le Play Store, on l'emballe en « Trusted Web Activity » : une vraie application Android
qui ouvre Platine Duo dans Chrome, donc avec le MIDI. Voici les étapes.

## 1. Le compte développeur (une seule fois)

1. https://play.google.com/console › créer un compte **personnel** (25 $ une fois, pièce d'identité demandée).
2. Pour un nouveau compte personnel, Google exige un **test fermé** : au moins **12 testeurs** inscrits pendant
   **14 jours d'affilée** avant de pouvoir publier pour tout le monde. Prévoyez une liste d'adresses Gmail
   (amis DJ, danseurs, élèves majeurs…).

## 2. Fabriquer l'application Android

1. Ouvrir https://www.pwabuilder.com, coller l'adresse `https://deltapassion.github.io/Platine-Duo/app/`.
2. **Package for stores › Android › Google Play**.
3. Réglages : Package ID `fr.jacques.platineduo` ; nom `Platine Duo 4V` ; version `2.0.0` ;
   orientation « Any » ; affichage « Fullscreen ».
4. Télécharger le paquet : il contient le fichier `.aab` (à envoyer à Google Play), la **clé de signature**
   (à garder précieusement, sans elle plus aucune mise à jour possible) et un fichier `assetlinks.json`.

## 3. Prouver que le site vous appartient (assetlinks.json)

Android vérifie que l'application et le site ont le même propriétaire. Le fichier doit être à la racine du domaine :
`https://deltapassion.github.io/.well-known/assetlinks.json`

1. Créer sur GitHub un nouveau dépôt public nommé exactement `Deltapassion.github.io`.
2. Y envoyer le fichier `assetlinks.json` fourni par PWABuilder, dans un dossier `.well-known`.
3. Settings › Pages › Branch `main`, dossier `/ (root)` › Save.
4. Si Google Play signe l'application (« Play App Signing »), ajouter aussi dans `assetlinks.json` l'empreinte SHA-256
   affichée dans la Play Console (Configuration › Intégrité de l'application).

## 4. La fiche Play Store

- Nom : Platine Duo 4V — Description courte : « Logiciel de mix DJ libre : platines, Auto DJ par styles, contrôleurs MIDI ».
- Catégorie : Musique et audio. Prix : gratuit. Publicité : non.
- Règles de confidentialité : `https://deltapassion.github.io/Platine-Duo/confidentialite.html`
- Sécurité des données : aucune donnée collectée ni partagée.
- Captures : téléphone et tablette (Platine Duo en mode Platines, Musique, Auto DJ).
- Icône 512 × 512 : `docs/app/icon-512.png`. Bannière 1024 × 500 : à partir de `docs/assets/partage.jpg`.
- Texte de rappel : « Platine Duo existe aussi pour PC Windows, Mac et Linux, et en version navigateur (HTML)
  qui gère les contrôleurs MIDI dans Chrome, Edge et Opera : https://deltapassion.github.io/Platine-Duo/ »

## 5. Test fermé puis publication

1. Play Console › Tests › Test fermé › créer une piste, envoyer le `.aab`, ajouter les 12 testeurs (ou plus).
2. Après 14 jours avec au moins 12 testeurs inscrits : demander l'accès à la production.
3. Publier. Les mises à jour du site (dossier `docs/app`) arrivent automatiquement dans l'application.
