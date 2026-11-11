/* Continuum — French overlays for the sample record.
   English in data.js stays the source. Missing keys fall back to English. */
(function () {
  const i18n = globalThis.ATELIER_I18N || (globalThis.ATELIER_I18N = {});
  i18n.content = i18n.content || {};
  i18n.content.fr = {
    media: {
      text: { label: "Texte" },
      video: { label: "Vidéo" },
      simulation: { label: "Simulation" },
      experiment: { label: "Expérience" },
      discussion: { label: "Discussion" },
    },
    levels: {
      "0": { label: "Non observé", hint: "Pas encore de preuve. Ce n’est pas une note basse." },
      "1": { label: "Émergent", hint: "Une première tentative est au dossier." },
      "2": { label: "En développement", hint: "Le travail est réel et pas encore assuré." },
      "3": { label: "Maîtrisé", hint: "Un palier sûr. Un travail plus tardif peut encore faire bouger la compétence." },
      "4": { label: "Avancé", hint: "La compétence a été étirée, et un travail plus loin peut encore ajouter une note." },
    },
    fields: {
      mathematics: {
        name: "Mathématiques", short: "Mathématiques",
        blurb: "Algèbre, géométrie, calcul et statistiques. Un résultat nomme son hypothèse.",
      },
      english: {
        name: "Anglais", short: "Anglais",
        blurb: "Lecture, écriture et rhétorique. Un lecteur qui n’était pas dans la pièce peut suivre le travail.",
      },
      physics: {
        name: "Physique", short: "Physique",
        blurb: "Mécanique, optique et expérience. Une prédiction peut être mise en défaut par une mesure.",
      },
      philosophy: {
        name: "Philosophie", short: "Philosophie",
        blurb: "Logique, connaissance et éthique. Un modèle peut être retiré, et quelqu’un vit avec le résultat.",
      },
    },
    people: {
      ibarra: { role: "Mentor", domain: "Physique" },
      adeyemi: { role: "Mentor", domain: "Philosophie et anglais" },
      vogel: { role: "Mentor", domain: "Mathématiques" },
      ortega: { role: "Direction", domain: "L’atelier dans son ensemble" },
    },
    competencies: {
      MA: {
        name: "Algèbre", short: "Algèbre",
        claim: "Utilise des équations pour relier des grandeurs dans une situation, et dit ce que l’équation laisse de côté.",
        rules: [
          "Les variables sont nommées et liées à la situation.",
          "Quelqu’un d’autre peut recalculer l’équation.",
          "Un trait que l’équation omet est nommé.",
        ],
        parts: {
          "MA-qty": { name: "Grandeur", about: "Elle nomme les quantités de la situation, et leurs unités." },
          "MA-eq": { name: "Équation", about: "Elle relie ces quantités pour qu’un autre puisse recalculer." },
          "MA-omit": { name: "Ce qu’elle laisse de côté", about: "Elle nomme un trait que l’équation omet." },
        },
      },
      MG: {
        name: "Géométrie", short: "Géométrie",
        claim: "Utilise la forme, l’angle ou la proportion pour décrire un arrangement physique.",
        rules: [
          "Une figure ou une proportion énoncée est attachée à la situation.",
          "Une mesure sur la figure correspond à une mesure dans le monde.",
          "Dit ce que le dessin aplatit ou ignore.",
        ],
        parts: {
          "MG-fig": { name: "Une figure", about: "Elle attache une forme ou une proportion à la situation." },
          "MG-meas": { name: "Une mesure", about: "Une longueur ou un angle sur la figure correspond au monde." },
          "MG-flat": { name: "Ce que le dessin ignore", about: "Elle dit ce que l’image plate laisse de côté." },
        },
      },
      MC: {
        name: "Calcul", short: "Calcul",
        claim: "Utilise le changement, le taux ou l’accumulation, et montre pourquoi le résultat s’ensuit.",
        rules: [
          "La grandeur qui change est nommée.",
          "Les étapes sont dans un ordre qu’un pair peut vérifier.",
          "Un geste clé est justifié, et l’hypothèse est énoncée.",
        ],
        parts: {
          "MC-basic": { name: "Calcul de base", about: "Elle nomme ce qui change, et un taux en mots ordinaires." },
          "MC-deriv": { name: "Dérivées", about: "Elle écrit ce taux comme sa propre fonction." },
          "MC-int": { name: "Intégrales", about: "Elle reconstruit la quantité accumulée à partir du taux." },
        },
      },
      MS: {
        name: "Statistiques", short: "Statistiques",
        claim: "Fait passer l’incertitude dans une conclusion au lieu de la remplacer par un seul nombre confiant.",
        rules: [
          "Un intervalle, une fourchette, ou un doute énoncé accompagne le résultat.",
          "Dit ce qui élargit l’écart.",
          "La conclusion garde l’incertitude visible.",
        ],
        parts: {
          "MS-band": { name: "Un écart", about: "Elle met une fourchette ou un doute énoncé à côté du nombre." },
          "MS-driver": { name: "Ce qui le produit", about: "Elle dit ce qui rend l’écart large ou étroit." },
          "MS-keep": { name: "Gardé dans la conclusion", about: "Le résultat qu’un lecteur voit porte encore le doute." },
        },
      },
      ER: {
        name: "Lecture", short: "Lecture",
        claim: "Retrouve l’affirmation et la raison dans le texte de quelqu’un d’autre, et dit ce que le texte ne tranche pas.",
        rules: [
          "L’affirmation de l’auteur est reformulée dans les mots de l’étudiant.",
          "Une raison est séparée d’un exemple.",
          "Une question que le texte laisse ouverte est nommée.",
        ],
        parts: {
          "ER-claim": { name: "L’affirmation", about: "Elle reformule l’affirmation de l’auteur dans les mots de l’étudiant." },
          "ER-reason": { name: "La raison", about: "Elle sépare une raison d’un exemple." },
          "ER-open": { name: "Ce qu’il laisse ouvert", about: "Elle nomme une question que le texte ne tranche pas." },
        },
      },
      EW: {
        name: "Écriture", short: "Écriture",
        claim: "Un lecteur hors du projet peut suivre l’affirmation, la raison, et la question ouverte.",
        rules: [
          "L’affirmation est en un seul endroit, en langue ordinaire.",
          "Les raisons suivent dans un ordre qu’un nouveau lecteur peut parcourir.",
          "Une révision répond à une question précise de quelqu’un d’autre.",
        ],
        parts: {
          "EW-claim": { name: "Une affirmation", about: "Elle met l’affirmation en un seul endroit, en langue ordinaire." },
          "EW-order": { name: "Un ordre", about: "Les raisons suivent dans un ordre qu’un nouveau lecteur peut parcourir." },
          "EW-rev": { name: "Une révision", about: "Un changement répond à une question précise de quelqu’un d’autre." },
        },
      },
      EH: {
        name: "Rhétorique", short: "Rhétorique",
        claim: "S’adresse à un public précis, répond à une objection, et garde un désaccord visible.",
        rules: [
          "Le public est nommé.",
          "La réponse rencontre l’objection qui a vraiment été faite.",
          "Un désaccord restant reste sur la page.",
        ],
        parts: {
          "EH-who": { name: "Un public", about: "Elle nomme à qui c’est destiné." },
          "EH-obj": { name: "L’objection", about: "La réponse rencontre l’objection qui a vraiment été faite." },
          "EH-split": { name: "Le désaccord", about: "Un désaccord restant reste sur la page." },
        },
      },
      PM: {
        name: "Mécanique", short: "Mécanique",
        claim: "Explique un résultat physique par les parties, les forces, et ce qu’elles font.",
        rules: [
          "Nomme les parties et ce qu’elles font.",
          "Relie le mécanisme au résultat observé.",
          "Ne s’arrête pas à une étiquette sans comment.",
        ],
        parts: {
          "PM-parts": { name: "Parties", about: "Elle nomme les parties et ce qu’elles font." },
          "PM-force": { name: "Forces", about: "Elle relie la poussée au résultat que l’on voit." },
          "PM-rate": { name: "Le taux", about: "Elle traite l’accélération, ou un autre changement, comme une dérivée." },
        },
      },
      PO: {
        name: "Optique", short: "Optique",
        claim: "Prédit le chemin de la lumière et dit ce qu’un schéma a le droit d’affirmer.",
        rules: [
          "Un rayon ou une image est dessiné pour un montage énoncé.",
          "Prédiction et observation peuvent toutes deux être montrées du doigt.",
          "Dit ce que le schéma ne montre pas.",
        ],
        parts: {
          "PO-ray": { name: "Un rayon", about: "Elle dessine le chemin de la lumière pour un montage énoncé." },
          "PO-both": { name: "Prédiction et observation", about: "Le chemin prédit et le chemin mesuré peuvent tous deux être montrés du doigt." },
          "PO-limit": { name: "Ce que le schéma omet", about: "Elle dit ce que le dessin ne montre pas." },
        },
      },
      PX: {
        name: "Expérience", short: "Expérience",
        claim: "Planifie ou mène une observation qui pourrait mettre l’idée à l’épreuve, pas seulement l’illustrer.",
        rules: [
          "Dit ce qui varie et ce qui est tenu fixe.",
          "Dit quel résultat compterait contre l’idée.",
          "Un autre étudiant pourrait suivre la procédure.",
        ],
        parts: {
          "PX-vary": { name: "Ce que vous faites varier", about: "Elle dit ce qui change et ce qui est tenu fixe." },
          "PX-against": { name: "Ce qui compterait contre", about: "Elle nomme le résultat qui mettrait l’idée à l’épreuve." },
          "PX-steps": { name: "Une procédure", about: "Un autre étudiant pourrait suivre les étapes." },
        },
      },
      PL: {
        name: "Logique", short: "Logique",
        claim: "Construit une affirmation avec des raisons, et garde stables les termes qui font le travail.",
        rules: [
          "Affirmation, raisons, et une conséquence ou une objection sont présentes.",
          "Les termes restent stables.",
          "Une étape qui ne s’ensuit pas n’est pas laissée comme si elle s’ensuivait.",
        ],
        parts: {
          "PL-case": { name: "Affirmation et raisons", about: "Une affirmation, des raisons, et une conséquence ou une objection sont présentes." },
          "PL-terms": { name: "Termes stables", about: "Les mots qui font le travail restent stables." },
          "PL-step": { name: "Une étape qui s’ensuit", about: "Un trou n’est pas laissé comme une preuve." },
        },
      },
      PK: {
        name: "Connaissance", short: "Connaissance",
        claim: "Sépare ce qu’un modèle ou une mesure montre de ce qu’on lui fait dire, et dit ce qui le retirerait.",
        rules: [
          "Deux notions sont énoncées à part, comme une mesure et une valeur, ou un modèle et le monde.",
          "Un cas montre où la distinction change une décision.",
          "Énonce quelle preuve pousserait le compte rendu actuel à changer.",
        ],
        parts: {
          "PK-apart": { name: "Deux choses à part", about: "Elle énonce une mesure et une valeur, ou un modèle et le monde, comme deux choses." },
          "PK-case": { name: "Là où ça compte", about: "Un cas montre où la distinction change une décision." },
          "PK-retire": { name: "Ce qui le retirerait", about: "Elle énonce quelle preuve pousserait le compte rendu à changer." },
        },
      },
      PE: {
        name: "Éthique", short: "Éthique",
        claim: "Dit qui est touché par un modèle, un indicateur ou un dessin, et ce qui leur est dû.",
        rules: [
          "Nomme des personnes qui portent la conséquence, pas seulement le système technique.",
          "Distingue un bénéfice, un tort, et une incertitude.",
          "Prend position sur ce qu’il faudrait faire, pour une raison qui n’est pas seulement l’efficacité.",
        ],
        parts: {
          "PE-who": { name: "Qui est touché", about: "Elle nomme les personnes, pas seulement le système." },
          "PE-kinds": { name: "Bénéfice, tort, doute", about: "Elle sépare un bénéfice, un tort, et une incertitude." },
          "PE-owed": { name: "Ce qui est dû", about: "Elle prend une position qui n’est pas seulement l’efficacité." },
        },
      },
    },
    workshops: {
      sampler: {
        name: "Quatre salles sur l’Arne",
        kind: "Exploratoire",
        summary: "La table des marées, la note de rue de Mara Quill, le canal, et qui reste mouillé. Rien n’est noté.",
        detail: "Greyhaven a quatre salles pour un nouvel étudiant. Dans l’une, vous lisez la marée de mardi contre le mur sud. Dans l’une, vous lisez ce que sont les heures de crue depuis la rue de Mara Quill. Dans l’une, vous vous tenez au canal pendant que l’eau affouille une pile modèle. Dans l’une, vous restez avec qui reste mouillé si le conseil finance la traversée nord. Vous pouvez parcourir les salles en un après-midi ou sur plusieurs. Les mentors remarquent ce que vous suivez, ce que vous sautez, et ce que vous demandez. Ces notes restent au mentor. Elles ne deviennent pas des notes, et elles ne font pas bouger une compétence. C’est ainsi qu’un nouvel étudiant rencontre la ville avant qu’une place de projet soit choisie.",
        activities: {
          "sampler-tide": { name: "Table des marées de mardi" },
          "sampler-note": { name: "Note de rue de Mara Quill" },
          "sampler-flume": { name: "Vingt minutes au canal" },
          "sampler-wet": { name: "Qui reste mouillé" },
        },
      },
      diagnostic: {
        name: "La marée de mardi",
        kind: "Diagnostic",
        summary: "Estimer les heures de crue au mur sud, chronométrer un petit pendule, écrire pour cette rue, et dire qui reste mouillé.",
        detail: "Quatre stations en un après-midi, toutes autour de la marée de mardi sur l’approche sud. Vous estimez combien d’heures par an cette rue est sous l’eau, et vous nommez l’hypothèse. Vous chronométrez un petit pendule, ou vous regardez l’affouillement à une pile modèle. Vous écrivez un paragraphe qu’un lecteur de cette rue peut suivre. Vous dites qui est touché si le conseil finance la traversée nord. Chaque station que vous terminez peut poser une note sur les compétences correspondantes. Une station que vous sautez reste vide, ce qui n’est pas un zéro. Les mentors se servent de ces notes pour accorder le premier projet à ce qu’il vous reste à faire.",
        activities: {
          "diag-estimation": { name: "Heures de crue au mur sud" },
          "diag-mechanics": { name: "Pendule ou affouillement de pile" },
          "diag-paragraph": { name: "Un paragraphe pour cette rue" },
          "diag-ethics": { name: "Qui est touché" },
        },
      },
      media: {
        name: "Le poids qui s’arrête",
        kind: "Diagnostic",
        summary: "Un poids sur un ressort, de quatre façons : notes, clip au ralenti, bac à sable, et banc. Le lendemain, vous écrivez ce que vous avez vu.",
        detail: "Sur le banc, un poids sur un ressort s’arrête peu à peu. Vous le rencontrez de quatre façons : une page de notes, un clip au ralenti, le modèle du bac à sable, et le montage physique. Le lendemain, vous écrivez ce qu’a fait le poids, dans vos mots, pour un lecteur qui n’était pas dans la pièce. Cette reconstruction peut être notée pour l’écriture, la rhétorique et la logique. Les mentors notent quelle façon de voir vous a aidé, pour que la tâche suivante soit proposée sous cette forme. La note vient de la reconstruction.",
        activities: {
          "media-reconstruction": { name: "Écrire ce qu’a fait le poids" },
        },
      },
      argument: {
        name: "Qui marche encore",
        kind: "Atelier",
        summary: "L’affirmation sur la table est souvent qu’une route plus haute est simplement plus sûre. Un pair demande qui marche encore sur l’approche sud. Vous révisez la page.",
        detail: "Vous apportez une affirmation que vous utilisez déjà. L’exemple travaillé dans la salle, c’est qu’une route plus haute est simplement la route plus sûre. Un pair pose une question, souvent qui marche encore sur l’approche sud à l’heure de crue. Vous révisez la page pour qu’un nouveau lecteur voie la réponse. Cette révision peut être notée pour la logique, la lecture, l’écriture et la rhétorique. Si ces compétences sont déjà dans votre dossier, vous pouvez passer cet atelier.",
        activities: {
          "argument-revision": { name: "La page de la route plus haute, révisée" },
        },
      },
    },
    projects: {
      coastal: {
        name: "La traversée côtière",
        place: "Greyhaven, à l’embouchure de l’Arne",
        summary: "Une traversée financée, une exposition inégale aux crues, et un argument public sur le risque qui reste.",
        brief: "Greyhaven garde une route basse à l’embouchure de l’Arne. Les marées de printemps couvrent déjà l’approche sud, où se trouve la plupart des logements locatifs. L’approche nord dessert les cliniques et le marché, un peu plus haut. Le conseil peut financer une seule traversée : une route surélevée, un pont court, ou un bac avec un horaire de crue. L’atelier veut un modèle, une observation qui aurait pu mettre le modèle en défaut, et une note d’une page qui dit qui reste mouillé.",
        varied: "L’étayage et le rôle peuvent changer. Les affirmations que le travail a le droit de compter ne changent pas.",
        features: {
          situation: { label: "Situation", text: "Une ville d’estuaire, deux quartiers, un budget. L’approche sud inonde d’abord." },
          tools: { label: "Outils", text: "Un canal ou le bac d’affouillement, une feuille qu’un autre peut relancer, et une note d’une page." },
          constraints: { label: "Contraintes", text: "Un budget fixe, une limite d’habitat, et un lecteur qui habite le quartier sud." },
          products: { label: "Travaux", text: "Carnet de modèle, journal d’observation, note publique, et une révision après la question de quelqu’un d’autre." },
        },
        activities: {
          "coastal-model": { name: "Modèle des chemins de charge" },
          "coastal-band": { name: "Bande d’incertitude" },
          "coastal-observation": { name: "Observation qui peut mettre le modèle en défaut" },
          "coastal-brief": { name: "Note publique" },
        },
      },
      "model-world": {
        name: "Le modèle et le monde",
        place: "Atelier du banc",
        summary: "Dériver un modèle, mesurer le système, et écrire ce qui vous ferait abandonner le modèle.",
        brief: "Un pendule, un seau qui fuit, ou une tasse qui refroidit. Prédire, puis mesurer. La philosophie est un travail, pas une préface : un mémo qui dit quelle preuve retirerait le modèle, et ce qu’un modèle révisé doit aux données. La pièce publique est un essai dont un nouvel étudiant pourrait se servir.",
        varied: "Quel système, et combien de la procédure est donnée. L’exigence de nommer une observation qui tuerait le modèle reste.",
        features: {
          situation: { label: "Situation", text: "Un petit système physique avec un modèle qui sera un peu faux." },
          tools: { label: "Outils", text: "Un banc, une dérivation sur papier, et un modèle de mémo qui exige une condition d’échec." },
          constraints: { label: "Contraintes", text: "L’essai a un lecteur qui n’a pas suivi de cours de physique." },
          products: { label: "Travaux", text: "Dérivation, journal de mesures, mémo de falsification, essai public." },
        },
        activities: {
          "model-derivation": { name: "Dérivation" },
          "model-measure": { name: "Journal de mesures" },
          "model-memo": { name: "Mémo de falsification" },
          "model-essay": { name: "Essai public" },
        },
      },
      measure: {
        name: "Mesurer ce qui compte",
        place: "Atelier des indicateurs",
        summary: "Construire un indice public, puis dire en prose qu’un habitant peut lire ce que l’indice ne voit pas.",
        brief: "La ville publie un nombre appelé vitalité d’apprentissage. Le projet est de construire un meilleur nombre, puis d’écrire, pour un habitant, ce que le nombre cache et qui est déplacé quand un quartier change de rang. Un modèle tranchant n’est pas encore une justification.",
        varied: "Quel nombre public. L’obligation de nommer une personne que le nombre rate ne varie pas.",
        features: {
          situation: { label: "Situation", text: "Un indice municipal qui classe les quartiers et déplace l’argent." },
          tools: { label: "Outils", text: "Un tableur et le bac de sensibilité. Pas de banc de physique spécial." },
          constraints: { label: "Contraintes", text: "Ce qui est caché doit être écrit pour un habitant, pas pour une section de méthodes." },
          products: { label: "Travaux", text: "Feuille d’indice, journal de sensibilité, et la note « ce qu’il cache »." },
        },
        activities: {
          "measure-index": { name: "Feuille d’indice" },
          "measure-sensitivity": { name: "Journal de sensibilité" },
          "measure-hides": { name: "Ce que l’indice cache" },
        },
      },
      light: {
        name: "Lumière, preuve et croyance",
        place: "Banc d’optique ou bac à rayons",
        summary: "Prédire un rayon, le mesurer, et écrire ce que la mesure vous autorise à croire.",
        brief: "Deux milieux, un angle prédit, un angle mesuré. La tâche se fait au banc ou dans le bac. L’écriture est courte et vient après la course : ce que la différence vous autorise à affirmer, et ce qu’elle n’autorise pas. Une longue lecture est une pratique optionnelle, pas le chemin vers la note.",
        varied: "Banc ou bac. Les matières que le travail peut compter ne changent pas avec le support.",
        features: {
          situation: { label: "Situation", text: "Un rayon qui traverse une frontière, et une croyance sur ce que l’angle montre." },
          tools: { label: "Outils", text: "Banc ou bac. Les deux peuvent produire l’observation. Le bac est le bon premier outil quand le texte est le point de blocage." },
          constraints: { label: "Contraintes", text: "L’affirmation écrite vient après la course, et elle tient en une demi-page." },
          products: { label: "Travaux", text: "Prédiction, mesure, et une courte affirmation sur ce que la différence autorise." },
        },
        activities: {
          "light-ray": { name: "Prédiction de rayon" },
          "light-measure": { name: "Angle mesuré" },
          "light-claim": { name: "Courte affirmation après la course" },
        },
      },
    },
    materials: {
      "mat-maps": {
        title: "Modèles et cartes",
        summary: "Un court essai sur la différence entre un modèle qui prédit et une description qui ne fait que ressembler à la chose.",
      },
      "mat-explain": {
        title: "Ce qui compte comme une explication",
        summary: "Un extrait de séminaire. Une explication a besoin de parties et d’un comment. Une étiquette n’est pas une explication.",
      },
      "mat-objection": {
        title: "Objection et réponse",
        summary: "Un protocole à deux. Une objection, une réponse, pas de changement de sujet. Utilisable dans n’importe quel projet.",
      },
      "mat-sandbox": {
        title: "Bac d’incertitude",
        summary: "Déplacez les entrées qui élargissent un résultat. La conclusion n’a pas le droit de se replier en un seul nombre.",
      },
      "mat-proof": {
        title: "Une dérivée annotée",
        summary: "Une courte dérivée avec les phrases justificatives écrites en marge, séparées de l’algèbre.",
      },
      "mat-estimate": {
        title: "Salle d’estimation",
        summary: "Dix grandeurs, un ordre de grandeur, l’hypothèse à l’écran. Fait pour les heures de crue au mur sud, et pour quiconque est rouillé.",
      },
      "mat-scour": {
        title: "Affouillement autour d’une pile",
        summary: "Images du canal. Ce qui varie, ce qui est tenu fixe, et où le trou se forme vraiment.",
      },
      "mat-optics": {
        title: "Protocole du banc d’optique",
        summary: "Une carte de banc pour la tâche du rayon. Un protocole est de la pratique. Le faire n’est pas encore une note.",
      },
      "mat-ray": {
        title: "Modèle de rayon interactif",
        summary: "Le même croisement que le banc, dans le bac. Le projet de Jun peut se faire entièrement ici.",
      },
      "mat-neighborhood": {
        title: "L’indicateur et le quartier",
        summary: "Un cas où un indice compétent déplace des fonds loin des gens que l’indice ne voit pas.",
      },
      "mat-brief": {
        title: "Comment une note devient une preuve",
        summary: "Ce qu’un mentor cherche dans une note publique d’une page, aligné sur la grille qu’un étudiant peut voir.",
      },
      "mat-critique": {
        title: "Un cercle de critique",
        summary: "Quatre étudiants, une affirmation, des questions qui restent sur l’affirmation. Un modèle pour le travail de révision.",
      },
      "mat-band-sheet": {
        title: "Une feuille qui garde la bande",
        summary: "Idris a mis sa feuille d’affouillement sur l’étagère. Marée, grain et erreur de modèle restent dans la conclusion. Un pair peut bouger les entrées et voir un seul nombre essayer de revenir.",
      },
      "mat-retire": {
        title: "Quand retirer un modèle",
        summary: "Notes du Dr Adeyemi au séminaire du banc. Un modèle gagne sa place jusqu’à ce qu’une observation énoncée aille contre lui. Un protocole sur l’étagère n’est pas un niveau.",
      },
      "mat-south-walk": {
        title: "Marcher l’approche sud",
        summary: "Mara Quill loue sur l’approche sud à Greyhaven. Elle a écrit ce que sont les heures de crue depuis cette rue, pour les étudiants qui brieferont le conseil.",
        contributor: { place: "Greyhaven, approche sud" },
      },
      "mat-hours": {
        title: "La colonne des heures du soir",
        summary: "Noor a écrit la série de présence que l’indice de vitalité laisse tomber, et a nommé les gens qui travaillent ces heures, pour que la prochaine personne à reconstruire le nombre puisse garder la colonne.",
      },
    },
    layers: {
      domain: {
        name: "Analyse du domaine",
        text: "Que font vraiment les gens compétents dans ces champs ? Nous avons rassemblé des performances en mathématiques, anglais, physique et philosophie, et du travail qui n’existe que là où ils se rencontrent. Les textes des domaines et les situations de projet viennent de ce recueil.",
      },
      modeling: {
        name: "Modélisation du domaine",
        text: "Transformer le recueil en argument. Si un mentor voit ce travail, il peut revendiquer cette compétence, à cause de ces règles. Chaque carte sur la carte est un tel argument. Toulmin le reconnaîtrait : affirmation, preuve, garantie.",
      },
      caf: {
        name: "Cadre conceptuel d’évaluation",
        text: "Trois modèles. Le modèle de compétences est la carte. Le modèle de preuve est la grille plus la règle de mise à jour : chaque travail noté ajoute une marque, et la ligne se remplit jusqu’au palier le plus loin. Le modèle de tâche est le projet ou l’atelier. Cette application est ce cadre, en marche sur une cohorte.",
      },
      implementation: {
        name: "Mise en œuvre de l’évaluation",
        text: "Les briefs, les cartes de station, les grilles, et ce tableau sont les matériaux construits. Une note est la lecture, par une personne, d’un travail contre une règle que l’étudiant peut ouvrir. Il n’y a pas de moyenne cachée.",
      },
      delivery: {
        name: "Délivrance de l’évaluation",
        text: "Un étudiant fait le travail. Un mentor note le travail. Le tableau se met à jour. L’étudiant voit les mêmes nombres. Quelqu’un agit : un étayage, un entretien, un brief révisé, ou une reconnaissance. Le tableau n’agit pas tout seul.",
      },
    },
    decisions: {
      "0": {
        title: "Le crédit est direct",
        text: "Les projets et les ateliers sont des tâches. Ils font apparaître des preuves. Ce ne sont pas des cours que l’on réussit en finissant les semaines. Les ressources sont ouvertes à tous. Une note exige une observation.",
      },
      "1": {
        title: "Une séance est une place, pas une note",
        text: "Ateliers, projets et cours sont planifiés avec un jour, une heure et une salle. Un étudiant s’inscrit depuis son propre compte. L’inscription retient une place. Elle n’ajoute pas de note, et elle ne prend pas une place de projet. Un cours vaut 0 point.",
      },
      "2": {
        title: "Les compétences bougent par paliers",
        text: "Un exercice, un test ou un projet ajoute une marque sur chaque compétence qu’il touche, et un même travail peut faire bouger plusieurs domaines à la fois. La ligne se remplit jusqu’au palier le plus loin atteint. Un palier, ce sont aussi les points : émergent vaut 1, en développement 2, maîtrisé 3, et avancé 4. Une action peut poser jusqu’à 4 points sur chaque compétence qu’elle est construite à faire apparaître. Algèbre, écriture, mécanique et éthique sont les compétences que chacun emporte. Atteindre un palier ne certifie pas l’étudiant.",
      },
      "3": {
        title: "Le tableau est partagé",
        text: "Étudiant, mentor et direction voient les mêmes lignes. Un étudiant peut contester une note. Une contestation laisse la ligne comme elle est jusqu’à ce que quelqu’un note le travail à nouveau. Un mentor peut noter que les compétences partagées sont assez loin. Cette phrase n’est pas un certificat.",
      },
      "4": {
        title: "Les étudiants jugent l’étagère",
        text: "Un étudiant, un professeur, ou quelqu’un hors de l’atelier peut ajouter une ressource, pour un domaine ou pour plusieurs à la fois. Chaque étudiant peut s’en servir. L’usage n’ajoute pas de note, et la pièce vaut 0 point. La qualité, c’est combien d’autres étudiants l’ont utilisée, et la moyenne des notes de qualité que ces étudiants ont données. Le contributeur ne note pas sa propre pièce. Texte, vidéo, simulation, expérience et discussion suivent la même règle.",
      },
    },
    sessions: {
      "sit-diag-amina": { place: "Salle des stations", note: "La marée de mardi. Les notes de cet après-midi sont dans le dossier d’Amina." },
      "sit-retire": {
        title: "Quand retirer un modèle",
        summary: "Un modèle gagne sa place jusqu’à ce qu’une observation énoncée aille contre lui. Les notes de ce cours sont sur l’étagère. Le cours lui-même ne pose aucune note.",
        place: "Salle de séminaire",
      },
      "sit-coastal-oct": { place: "Canal d’essai", note: "La feuille d’affouillement reste recalculable. Marée, grain et erreur de modèle restent dans la conclusion." },
      "sit-leo-diag": { place: "Salle des stations", note: "Heures de crue au mur sud. L’ordre de grandeur était plausible. Les unités ont glissé." },
      "sit-leo-media": { place: "Atelier du banc", note: "Le poids sur le ressort, de quatre façons. La reconstruction est notée le lendemain." },
      "sit-sampler-oct": { place: "Atelier et canal", note: "Premier après-midi. Le plus long arrêt a été au canal. Pas de note." },
      "sit-south": {
        title: "À quoi ressemble l’approche sud à l’heure de crue",
        summary: "Les heures de crue et la valeur d’une maison ne sont pas la même affirmation. Un cours avant la note côtière. S’inscrire ne note pas l’éthique.",
        place: "Salle de séminaire",
      },
      "sit-sampler-nov": { place: "Atelier et canal", note: "Deuxième après-midi. La salle sur qui reste mouillé est encore devant." },
      "sit-argument-nov": { place: "Salle de séminaire", note: "L’affirmation sur la table est souvent qu’une route plus haute est simplement plus sûre. Une question, puis une révision." },
      "sit-light-nov": { place: "Banc d’optique", note: "Prédire un rayon, puis le mesurer. L’affirmation écrite vient après la course." },
      "sit-coastal-nov": { place: "Canal d’essai", note: "Ouvert à la cohorte. Une place au canal n’est pas une place sur le projet." },
      "sit-model-nov": { place: "Atelier du banc", note: "Nommer l’observation qui retirerait le modèle." },
      "sit-diag-nov": { place: "Salle des stations", note: "Heures de crue, un petit pendule, un paragraphe pour cette rue, et qui reste mouillé. Des places sont libres." },
      "sit-measure-nov": { place: "Atelier des indicateurs", note: "L’indice, puis la phrase sur ce qu’il ne peut pas voir." },
      "sit-column": {
        title: "La colonne qu’un nombre laisse tomber",
        summary: "Comment un indice perd les heures du soir, et comment une feuille peut garder la colonne. Un cours ne pose aucune note.",
        place: "Salle de séminaire",
      },
      "sit-media-nov": { place: "Atelier du banc", note: "Notes, un clip au ralenti, le bac, et le ressort sur le banc. La reconstruction peut être notée." },
      "sit-belief": {
        title: "Une mesure et ce qu’elle autorise",
        summary: "Ce que la différence entre un angle prédit et un angle mesuré vous autorise à affirmer. Le bac est bienvenu. La note exige encore l’affirmation écrite.",
        place: "Banc d’optique",
      },
    },
    evidence: {
      "ev-amina-diag": {
        title: "La marée de mardi",
        summary: "Heures de crue au mur sud, un petit pendule, un paragraphe pour cette rue, et un premier passage sur qui reste mouillé si la traversée nord est financée.",
        rubric: "Algèbre, expérience, écriture et mécanique sont commencées. L’éthique nomme la ville et ne dit pas encore ce qui est dû.",
      },
      "ev-amina-arg": {
        title: "Qui marche encore, révisé",
        summary: "A révisé l’affirmation qu’une route plus haute est simplement la route plus sûre, après qu’Idris a demandé qui marche encore sur l’approche sud.",
        rubric: "La logique rencontre la question. La lecture de l’objection d’Idris est en développement. L’écriture est maîtrisée.",
      },
      "ev-amina-load": {
        title: "Carnet des chemins de charge",
        summary: "Suit la charge utile, l’eau et l’affouillement sous la pile sud d’une route surélevée, avec la couche de sol omise nommée.",
        rubric: "La mécanique est assez précise pour être inspectée. L’algèbre du chemin de charge est maîtrisée. La géométrie de la pile est en développement. Le calcul de l’estimation d’affouillement suppose un lit uniforme.",
      },
      "ev-leo-est": {
        title: "Heures de crue au mur sud",
        summary: "A estimé combien d’heures par an l’approche sud est sous l’eau. L’ordre de grandeur est plausible. Les unités ont glissé à mi-chemin.",
        rubric: "Algèbre et statistiques sont émergentes. La décision que le nombre servirait est nommée, et le nombre lui-même n’est pas encore stable.",
      },
      "ev-leo-pend": {
        title: "Micro-expérience du pendule",
        summary: "A nommé la longueur comme variable. A enregistré dix périodes. Une partie de la procédure est copiée de la carte de station.",
        rubric: "La mécanique est une esquisse en développement. L’expérience est émergente : la procédure ne rattraperait pas encore une fausse idée, et une partie en est copiée de la carte de station.",
      },
      "ev-leo-media": {
        title: "Écrire ce qu’a fait le poids",
        summary: "A écrit ce qu’il a pu reconstruire du poids qui s’arrête. Le clip au ralenti est présent. La longue page de notes est floue.",
        rubric: "L’écriture est en développement : un lecteur peut suivre une courte affirmation, et elle est à lui. Rhétorique et logique sont encore émergentes.",
      },
    },
    notes: {
      "note-rafi-1": { text: "Le plus long arrêt a été au canal. A demandé si la salle sur qui reste mouillé n’était que de la parole. Pas de note. Cette remarque n’est pas un niveau." },
      "note-leo-1": { text: "Le souvenir du lendemain était le plus fort après le clip au ralenti et mince après la longue page de notes. Préférence : vidéo, puis le ressort sur le banc. La reconstruction écrite est notée à part, comme preuve." },
      "note-jun-1": { text: "Jun s’est arrêté au milieu du chapitre assigné et a dit que la simulation aurait été plus facile à suivre. Aucune observation suivante n’a été fixée après cette remarque." },
    },
    plates: {
      sampler: {
        title: "Quatre salles sur l’Arne. Table des marées, note de rue, canal, et qui reste mouillé. Rien n’est noté ici.",
        s1: "Table des marées", s2: "Note de rue", s3: "Le canal", s4: "Qui est mouillé",
        caption: "Rien n’est noté ici.",
      },
      diagnostic: {
        title: "La marée de mardi. Quatre stations : heures de crue, un pendule, un paragraphe pour cette rue, et qui est touché. Une station sautée reste vide.",
        s1: "Heures de crue", s2: "Pendule", s3: "Cette rue", s4: "Qui est touché",
        d1: "Algèbre · Statistiques", d2: "Mécanique · Expérience", d3: "Écriture", d4: "Éthique",
        caption: "Une station sautée reste vide.",
      },
      media: {
        title: "Le poids qui s’arrête. Notes, un clip au ralenti, le bac, et le ressort sur le banc. La reconstruction est la note, le lendemain.",
        s1: "Notes", s2: "Clip", s3: "Bac", s4: "Ressort",
        d1: "La page", d2: "Ralenti", d3: "Le modèle", d4: "Le banc",
        caption: "La reconstruction est la note, le lendemain.",
      },
      argument: {
        title: "Qui marche encore. L’affirmation de la route plus haute, une question d’un pair, et une révision.",
        s1: "Route haute", s2: "Qui marche", s3: "Révision",
        d1: "Votre affirmation", d2: "Un pair", d3: "La nouvelle page",
        caption: "La révision répond à la question.",
      },
    },
  };
})();
