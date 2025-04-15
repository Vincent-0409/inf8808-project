import { Component } from '@angular/core';

@Component({
  selector: 'app-draft-scatter-plot',
  templateUrl: './draft-scatter-plot.component.html',
  styleUrls: ['./draft-scatter-plot.component.scss']
})
export class DraftScatterPlotComponent {

  
      // Création du nuage de points interactif pour analyser la relation entre
      // le succès des équipes (points en saison régulière) et le nombre de joueurs repêchés
      // en première ronde ou dans le top 5

      // Définition des dimensions et marges
      const margin = {
          top: 50,
          right: 50,
          bottom: 70,
          left: 80,
        },
        width = 900 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

      // Variable pour suivre le mode d'affichage (première ronde ou top cinq)
      let displayMode = 'première ronde';

      // Création du SVG (sera initialisé après le chargement des données)
      let svg;

      // Création du bouton toggle (sera initialisé après le chargement des données)
      const toggleContainer = d3
        .select('#visualization')
        .append('div')
        .attr('class', 'toggle-container')
        .style('display', 'none'); // Masqué initialement

      toggleContainer.html(`
            <button id="toggleBtn" class="toggle-btn active">PREMIÈRE RONDE</button>
            <button id="toggleBtn2" class="toggle-btn">TOP CINQ</button>
        `);

      const stanleyCupWinners = [
        'Toronto Maple Leafs-1963',
        'Toronto Maple Leafs-1964',
        'Montreal Canadiens-1965',
        'Montreal Canadiens-1966',
        'Toronto Maple Leafs-1967',
        'Montreal Canadiens-1968',
        'Montreal Canadiens-1969',
        'Boston Bruins-1970',
        'Montreal Canadiens-1971',
        'Boston Bruins-1972',
        'Montreal Canadiens-1973',
        'Philadelphia Flyers-1974',
        'Philadelphia Flyers-1975',
        'Montreal Canadiens-1976',
        'Montreal Canadiens-1977',
        'Montreal Canadiens-1978',
        'Montreal Canadiens-1979',
        'New York Islanders-1980',
        'New York Islanders-1981',
        'New York Islanders-1982',
        'New York Islanders-1983',
        'Edmonton Oilers-1984',
        'Edmonton Oilers-1985',
        'Montreal Canadiens-1986',
        'Edmonton Oilers-1987',
        'Edmonton Oilers-1988',
        'Calgary Flames-1989',
        'Edmonton Oilers-1990',
        'Pittsburgh Penguins-1991',
        'Pittsburgh Penguins-1992',
        'Montreal Canadiens-1993',
        'New York Rangers-1994',
        'New Jersey Devils-1995',
        'Colorado Avalanche-1996',
        'Detroit Red Wings-1997',
        'Detroit Red Wings-1998',
        'Dallas Stars-1999',
        'New Jersey Devils-2000',
        'Colorado Avalanche-2001',
        'Detroit Red Wings-2002',
        'New Jersey Devils-2003',
        'Tampa Bay Lightning-2004',
        // 2005 : Saison annulée en raison d'un lock-out
        'Carolina Hurricanes-2006',
        'Anaheim Ducks-2007',
        'Detroit Red Wings-2008',
        'Pittsburgh Penguins-2009',
        'Chicago Blackhawks-2010',
        'Boston Bruins-2011',
        'Los Angeles Kings-2012',
        'Chicago Blackhawks-2013',
        'Los Angeles Kings-2014',
        'Chicago Blackhawks-2015',
        'Pittsburgh Penguins-2016',
        'Pittsburgh Penguins-2017',
        'Washington Capitals-2018',
        'St. Louis Blues-2019',
        'Tampa Bay Lightning-2020',
        'Tampa Bay Lightning-2021',
        'Colorado Avalanche-2022',
      ];

      // Ajouter un titre et une info sur la mise à jour du graphique
      document.querySelector('.description').innerHTML += `
        <p class="update-info" style="margin-top: 20px; padding: 10px; background: #f8f8f8; border-left: 4px solid #333; font-style: italic;">
          ✓ Visualisation optimisée: Les points sont organisés grâce à D3 Force Simulation pour éviter les superpositions tout en maintenant la lisibilité des données.
        </p>
        <p class="update-info" style="margin-top: 10px; padding: 10px; background: #f8f8f8; border-left: 4px solid #c00; font-style: italic;">
          ✓ Mise à jour: Les points avec exactement 65 points accumulés ont été supprimés du graphique.
        </p>
      `;

      // Chargement des données réelles depuis le fichier CSV
      d3.csv('nhldraft.csv')
        .then(function (csvData) {
          // Masquer le message de chargement
          d3.select('.loading').remove();

          // Afficher les boutons toggle
          toggleContainer.style('display', 'block');

          // Initialiser le SVG maintenant que les données sont chargées
          svg = d3
            .select('#visualization')
            .append('svg')
            .attr(
              'width',
              width + margin.left + margin.right,
            )
            .attr(
              'height',
              height + margin.top + margin.bottom,
            )
            .append('g')
            .attr(
              'transform',
              `translate(${margin.left}, ${margin.top})`,
            );

          // Traiter les données
          const teamSeasonData = processData(csvData);

          // Affichage initial
          renderScatterPlot(teamSeasonData);

          // Gestion des événements du bouton toggle
          d3.select('#toggleBtn').on('click', function () {
            displayMode = 'première ronde';
            d3.select('#toggleBtn').classed('active', true);
            d3.select('#toggleBtn2').classed(
              'active',
              false,
            );
            updateVisualization(teamSeasonData);
          });

          d3.select('#toggleBtn2').on('click', function () {
            displayMode = 'top cinq';
            d3.select('#toggleBtn').classed(
              'active',
              false,
            );
            d3.select('#toggleBtn2').classed(
              'active',
              true,
            );
            updateVisualization(teamSeasonData);
          });
        })
        .catch(function (error) {
          // En cas d'erreur de chargement du fichier
          console.error(
            'Erreur lors du chargement des données:',
            error,
          );
          d3.select('.loading')
            .html(
              `
                <strong>Erreur lors du chargement des données</strong><br>
                Vérifiez que le fichier nhldraft.csv est bien présent dans le même dossier que ce fichier HTML.
            `,
            )
            .style('color', 'red');
        });

      // Fonction pour traiter les données brutes du CSV
      function processData(data) {
        // Convertir les valeurs numériques
        data.forEach((d) => {
          d.year = +d.year;
          d.overall_pick = +d.overall_pick;
          d.points = +d.points || 0;
          d.games_played = +d.games_played || 0;
          d.goals = +d.goals || 0;
          d.assists = +d.assists || 0;
        });

        // Créer un dictionnaire pour stocker les données des équipes par saison
        const teamSeasons = {};

        // Liste des saisons à analyser (à partir des données disponibles)
        const seasons = [
          ...new Set(data.map((d) => d.year)),
        ].sort();

        // Liste des équipes NHL (extraites des données)
        const nhlTeams = [
          ...new Set(data.map((d) => d.team)),
        ];

        // Pour chaque équipe et saison, calculer les statistiques
        nhlTeams.forEach((team) => {
          seasons.forEach((year) => {
            const seasonKey = `${team}-${year}`;

            // Obtenir tous les joueurs de cette équipe pour cette saison
            const teamData = data.filter(
              (d) => d.team === team && d.year === year,
            );

            if (teamData.length > 0) {
              // Filtrer les joueurs repêchés en première ronde (picks 1-31)
              const firstRoundPicks = teamData.filter(
                (d) => d.overall_pick <= 31,
              );

              // Filtrer les joueurs repêchés dans le top 5 (picks 1-5)
              const topFivePicks = teamData.filter(
                (d) => d.overall_pick <= 5,
              );

              // Calculer les points de la saison en sommant les points des joueurs
              // Dans un cas réel, vous auriez les données réelles des points de l'équipe
              // Ici on utilise une approximation basée sur les performances individuelles
              const totalPoints = teamData.reduce(
                (sum, player) => sum + player.points,
                0,
              );
              const seasonPoints = Math.min(
                130,
                Math.max(65, Math.floor(totalPoints / 10)),
              ); // Limiter entre 65 et 130

              // Déterminer si l'équipe a remporté la coupe Stanley cette saison
              const wonStanleyCup =
                stanleyCupWinners.includes(
                  `${team}-${year}`,
                );

              // Exclure les équipes avec exactement 65 points
              if (seasonPoints !== 65) {
                teamSeasons[seasonKey] = {
                  team: team,
                  year: year,
                  firstRoundPicksCount:
                    firstRoundPicks.length,
                  topFivePicksCount: topFivePicks.length,
                  seasonPoints: seasonPoints,
                  wonStanleyCup: wonStanleyCup,
                };
              }
            }
          });
        });

        // Convertir en tableau pour D3
        return Object.values(teamSeasons);
      }

      // Fonction pour rendre le nuage de points avec d3.forceSimulation
      function renderScatterPlot(data) {
        // Nettoyer le SVG
        svg.selectAll('*').remove();

        // Définir les échelles
        // Pour l'axe X, nous utilisons une échelle discrète pour mieux distinguer les valeurs
        const xValues = [
          ...new Set(
            data.map((d) =>
              displayMode === 'première ronde'
                ? d.firstRoundPicksCount
                : d.topFivePicksCount,
            ),
          ),
        ].sort((a, b) => a - b);

        // Calculer le domaine X maximal pour avoir assez d'espace
        const xMax = Math.max(8, d3.max(xValues) + 1);

        // Utiliser une échelle non-linéaire pour donner plus d'espace à x=0, moins à x=1 et encore moins à x=2
        const xScale = d3
          .scalePoint()
          .domain(
            [0, 1, 2, 3, 4, 5, 6, 7, 8].slice(0, xMax + 1),
          )
          .range([0, width])
          .padding(1.3);

        // Ajuster manuellement l'espacement pour donner plus de place à x=0, moins à x=1, etc.
        const xAdjust = {};
        xAdjust[0] = 0; // position de référence pour x=0
        xAdjust[1] = width * 0.28; // position pour x=1 (au lieu de width/2 ou width/3)
        xAdjust[2] = width * 0.43; // position pour x=2
        for (let i = 3; i <= xMax; i++) {
          xAdjust[i] = width * ((i + 0.39) / 10 + 0.22);
        }

        // Pour l'axe Y, ajuster pour mieux distribuer les points
        // Exclure explicitement la valeur 65
        const filteredYValues = data
          .map((d) => d.seasonPoints)
          .filter((y) => y !== 65);
        const yMin = Math.max(
          60,
          d3.min(filteredYValues) - 5,
        );
        const yMax = d3.max(filteredYValues) + 10;

        const yScale = d3
          .scaleLinear()
          .domain([yMin, yMax])
          .range([height, 0])
          .nice();

        // Créer une grille verticale pour distinguer clairement les valeurs entières sur l'axe X
        const gridLinesX = svg
          .append('g')
          .attr('class', 'grid-lines')
          .selectAll('line')
          .data(xValues)
          .enter()
          .append('line')
          .attr('x1', (d) => xAdjust[d] || xScale(d))
          .attr('y1', 0)
          .attr('x2', (d) => xAdjust[d] || xScale(d))
          .attr('y2', height)
          .attr('stroke', '#e0e0e0')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3');

        // Ajouter les axes
        // Créer un axe X personnalisé avec des positions ajustées
        const xAxis = svg
          .append('g')
          .attr('transform', `translate(0, ${height})`);

        // Ajouter une ligne horizontale pour l'axe
        xAxis
          .append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', width)
          .attr('y2', 0)
          .attr('stroke', 'black')
          .attr('stroke-width', 1);

        // Ajouter des ticks personnalisés
        xValues.forEach((d) => {
          const xPos = xAdjust[d] || xScale(d);

          // Ligne de tick
          xAxis
            .append('line')
            .attr('x1', xPos)
            .attr('y1', 0)
            .attr('x2', xPos)
            .attr('y2', 6)
            .attr('stroke', 'black');

          // Texte
          xAxis
            .append('text')
            .attr('x', xPos)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .text(d);
        });

        svg
          .append('g')
          .call(d3.axisLeft(yScale))
          .selectAll('text')
          .attr('font-weight', 'bold');

        // Ajouter les titres des axes
        svg
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('x', width / 2)
          .attr('y', height + margin.bottom - 10)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .text(
            `NOMBRE DE JOUEURS DE ${displayMode.toUpperCase()}`,
          );

        svg
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('transform', 'rotate(-90)')
          .attr('x', -height / 2)
          .attr('y', -margin.left + 20)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .text('NOMBRE TOTAL DE POINTS ACCUMULÉS');

        // Ajouter un titre pour toutes les années
        svg
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('x', width / 2)
          .attr('y', -margin.top / 2)
          .style('font-size', '16px')
          .style('font-weight', 'bold')
          .text('TOUTES LES ANNÉES (1963-2022)');

        // Préparation des données pour la simulation de forces
        // Utiliser une échelle pour jitter les points ayant la même valeur X
        const nodeData = data.map((d) => {
          return {
            id: `${d.team}-${d.year}`,
            team: d.team,
            year: d.year,
            firstRoundPicksCount: d.firstRoundPicksCount,
            topFivePicksCount: d.topFivePicksCount,
            seasonPoints: d.seasonPoints,
            wonStanleyCup: d.wonStanleyCup,
            xValue:
              displayMode === 'première ronde'
                ? d.firstRoundPicksCount
                : d.topFivePicksCount,
            // Position initiale approximative pour la simulation
            x: xScale(
              displayMode === 'première ronde'
                ? d.firstRoundPicksCount
                : d.topFivePicksCount,
            ),
            y: yScale(d.seasonPoints),
          };
        });

        // Créer des groupes pour chaque valeur x unique afin de maintenir les points dans leurs colonnes respectives
        const xGroups = {};
        xValues.forEach((val) => {
          xGroups[val] = nodeData.filter(
            (d) => d.xValue === val,
          );
        });
        // Initialiser la simulation de force avec d3.forceSimulation
        const simulation = d3
          .forceSimulation(nodeData)
          // Forcer les nœuds à rester près de leur valeur X (colonne)
          .force(
            'x',
            d3
              .forceX()
              .x(
                (d) =>
                  xAdjust[d.xValue] || xScale(d.xValue),
              )
              .strength(0.8),
          )
          // Forcer les nœuds à rester près de leur valeur Y
          .force(
            'y',
            d3
              .forceY()
              .y((d) => yScale(d.seasonPoints))
              .strength(0.8),
          )
          // Éviter les collisions entre nœuds - rayon légèrement plus grand que le rayon visible
          .force(
            'collision',
            d3.forceCollide().radius(7).strength(0.8),
          )
          .alpha(0.5)
          .alphaDecay(0.05)
          // Force de cluster pour regrouper les points par valeur x
          .force('cluster', (alpha) => {
            for (let i = 0; i < nodeData.length; i++) {
              const d = nodeData[i];
              const group = xGroups[d.xValue];
              if (group.length > 1) {
                // Trouver le centre du groupe (moyennes des positions y)
                let sumY = 0;
                group.forEach((g) => (sumY += g.y));
                const centerY = sumY / group.length;

                // Forcer légèrement vers ce centre
                d.y += (centerY - d.y) * alpha * 0.1;
              }
            }
          })
          // Limiter les points à la zone du graphique
          .force('boundary', () => {
            for (let i = 0; i < nodeData.length; i++) {
              const d = nodeData[i];
              // Marge pour éviter que les points ne soient trop près des axes
              const margin = 10;

              // Contraindre x à rester près de sa valeur d'origine et dans les limites
              d.x = Math.max(
                margin,
                Math.min(width - margin, d.x),
              );

              // Contraindre y à rester dans les limites
              d.y = Math.max(
                margin,
                Math.min(height - margin, d.y),
              );

              // Forcer les points à rester dans une bande verticale autour de leur valeur x
              const xPos =
                xAdjust[d.xValue] || xScale(d.xValue);

              // Distances maximales variables selon la valeur de x
              let maxDistance;
              if (d.xValue === 0) {
                maxDistance = 45; // Plus d'espace pour x=0
              } else if (d.xValue === 1) {
                maxDistance = 35; // Espace moyen pour x=1
              } else if (d.xValue === 2) {
                maxDistance = 35; // Plus d'espace pour x=2
              } else {
                maxDistance = 20; // Moins d'espace pour x>=3
              }

              if (Math.abs(d.x - xPos) > maxDistance) {
                d.x =
                  xPos +
                  (d.x > xPos ? maxDistance : -maxDistance);
              }
            }
          });

        // Ajouter des cercles pour tous les nœuds, mais ne pas les afficher tout de suite
        const circles = svg
          .selectAll('.point')
          .data(nodeData)
          .enter()
          .append('circle')
          .attr('class', 'point')
          .attr('r', 5)
          .style('fill', (d) =>
            d.wonStanleyCup ? '#F9A826' : '#000',
          )
          .style('opacity', 0.8)
          .style('stroke', 'white')
          .style('stroke-width', 0.5)
          .on('mouseover', function (event, d) {
            // Afficher l'info-bulle
            showTooltip(event, d);
            // Mettre en évidence le point
            d3.select(this)
              .attr('r', 8)
              .style('opacity', 1)
              .style('stroke-width', 1);
          })
          .on('mouseout', function () {
            // Masquer l'info-bulle
            hideTooltip();
            // Remettre le point à sa taille normale
            d3.select(this)
              .attr('r', 5)
              .style('opacity', 0.8)
              .style('stroke-width', 0.5);
          });

        // Configurer la fonction tick pour mettre à jour les positions
        simulation.on('tick', () => {
          circles
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => d.y);
        });

        // Arrêter la simulation après un certain nombre d'itérations pour optimiser les performances
        setTimeout(() => {
          simulation.stop();
        }, 2000);

        // Ajouter une légende
        const legend = svg
          .append('g')
          .attr('class', 'legend')
          .attr(
            'transform',
            `translate(${width - 250}, -50)`,
          );

        legend
          .append('rect')
          .attr('width', 300)
          .attr('height', 60)
          .attr('fill', 'white')
          .attr('stroke', '#ccc')
          .attr('stroke-width', 1)
          .attr('rx', 5);

        legend
          .append('circle')
          .attr('cx', 20)
          .attr('cy', 20)
          .attr('r', 5)
          .style('fill', '#F9A826')
          .style('stroke', 'white')
          .style('stroke-width', 0.5);

        legend
          .append('text')
          .attr('x', 35)
          .attr('y', 25)
          .text('Équipe qui a remporté la Coupe Stanley')
          .style('font-size', '12px');

        legend
          .append('circle')
          .attr('cx', 20)
          .attr('cy', 40)
          .attr('r', 5)
          .style('fill', '#000')
          .style('stroke', 'white')
          .style('stroke-width', 0.5);

        legend
          .append('text')
          .attr('x', 35)
          .attr('y', 45)
          .text(
            "Équipe qui n'a pas remporté la Coupe Stanley",
          )
          .style('font-size', '12px');
      }

      // Fonction pour afficher l'info-bulle
      function showTooltip(event, d) {
        // Créer une info-bulle si elle n'existe pas déjà
        let tooltip = d3.select('body').select('.tooltip');

        if (tooltip.empty()) {
          tooltip = d3
            .select('body')
            .append('div')
            .attr('class', 'tooltip');
        }

        // Contenu de l'info-bulle
        tooltip
          .html(
            `
          <strong>${d.team}</strong><br>
          Saison: ${d.year}-${d.year + 1}<br>
          Nombre de joueurs repêchés en ${displayMode}: <strong>${displayMode === 'première ronde' ? d.firstRoundPicksCount : d.topFivePicksCount}</strong><br>
          Points en saison régulière: <strong>${d.seasonPoints}</strong><br>
          ${d.wonStanleyCup ? '<span style="color:#F9A826; font-weight:bold;">A remporté la Coupe Stanley</span>' : ''}
        `,
          )
          .style('left', event.pageX + 15 + 'px')
          .style('top', event.pageY - 15 + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);
      }

      // Fonction pour masquer l'info-bulle
      function hideTooltip() {
        d3.select('.tooltip')
          .transition()
          .duration(200)
          .style('opacity', 0);
      }

      // Fonction pour mettre à jour la visualisation lors du changement de mode
      function updateVisualization(data) {
        // Redessiner complètement le graphique pour s'assurer que les positions des points
        // sont recalculées correctement pour éviter la superposition
        renderScatterPlot(data);
      }
}
