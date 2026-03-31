// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    try {
      const patrimoineData = [
        {
          title: "Chutes de Kota",
          description: "Un havre de fraîcheur et de biodiversité, offrant des paysages spectaculaires au cœur de la nature béninoise.",
          imageName: "Chutes de Kota.jpg"
        },
        {
          title: "Cité Lacustre de Ganvié",
          description: "La Venise de l'Afrique, une ville entièrement bâtie sur l'eau, témoin d'une histoire de résistance et d'adaptation unique.",
          imageName: "Cité Lacustre Ganvié.jpg"
        },
        {
          title: "Palais Royaux d'Abomey",
          description: "Haut lieu de l'histoire du Royaume de Dahomey, classé au patrimoine mondial de l'UNESCO, abritant les trônes et les récits des rois guerriers.",
          imageName: "Palais Royaux Abomey.jpg"
        },
        {
          title: "La Porte du Non-Retour",
          description: "Lieu de mémoire poignant à Ouidah, marquant le départ des esclaves vers les Amériques. Un symbole de résilience et d'histoire partagée.",
          imageName: "Porte du Non-Retour.jpg"
        },
        {
          title: "Tata Somba",
          description: "Architecture traditionnelle unique du peuple Batammariba, ces châteaux forts en terre crue sont un chef-d'œuvre du génie humain.",
          imageName: "TATA SOMBA.jpg"
        },
        {
          title: "Le Zangbeto",
          description: "Gardien de la nuit et force spirituelle vaudou, le Zangbeto veille sur la sécurité et l'ordre dans les communautés du Sud-Bénin.",
          imageName: "Zangpeto.jpg"
        },
        {
          title: "Place de l'Amazone",
          description: "Monument majestueux rendant hommage aux guerrières Agoodjié du Dahomey, symbole de la bravoure et de la force féminine au Bénin.",
          imageName: "place-amazone.jpg"
        },
        {
          title: "Monument Bio Guerra",
          description: "Statue équestre honorant le héros national Bio Guerra, figure de proue de la résistance contre la colonisation dans le nord du pays.",
          imageName: "bio-guera.jpg"
        },
        {
          title: "Temple des Pythons",
          description: "Site sacré à Ouidah dédié au culte du python, illustrant la cohabitation pacifique entre l'homme, la nature et le sacré.",
          imageName: "ouidah-temple-python-3.jpg"
        },
        {
          title: "Grand-Popo",
          description: "Cité balnéaire pittoresque entre mer et fleuve, réputée pour ses plages de sable fin et son patrimoine colonial préservé.",
          imageName: "Grand-Popo.jpg"
        },
        {
          title: "Mur de Fresques de Cotonou",
          description: "L'une des plus longues fresques murales d'Afrique, racontant l'histoire et les aspirations du peuple béninois à travers l'art urbain.",
          imageName: "Mur de Fresque de Cotonou.jpg"
        },
        {
          title: "Parc National de la Pendjari",
          description: "Joyau de la biodiversité ouest-africaine, ce sanctuaire sauvage abrite lions, éléphants et une faune exceptionnelle dans un cadre protégé.",
          imageName: "Parc Pendjari.jpg"
        }
      ];

      // Check if data already exists to avoid duplicates
      const existing = await strapi.entityService.findMany('api::patrimoine.patrimoine', {
        limit: 1
      });

      // Special check for expansion: If we only have 6, add the next 6
      const count = await strapi.entityService.count('api::patrimoine.patrimoine');

      if (count < patrimoineData.length) {
        console.log('🌍 Expanding/Seeding Patrimoine data...');
        for (const item of patrimoineData) {
          // Find if already exists
          const itemExists = await strapi.entityService.findMany('api::patrimoine.patrimoine', {
            filters: { title: item.title },
            limit: 1
          });

          if (itemExists.length === 0) {
            await strapi.entityService.create('api::patrimoine.patrimoine', {
              data: {
                ...item,
                publishedAt: new Date(),
              },
            });
          }
        }
        console.log('✅ Patrimoine data updated successfully.');
      }

      // Update Site Settings with new contact info
      try {
        // findMany returns an array
        const siteSettings = await strapi.entityService.findMany('api::site-setting.site-setting', { limit: 1 });
        // safe check: if array has items, take the first one
        const siteSetting = Array.isArray(siteSettings) && siteSettings.length > 0 ? siteSettings[0] : null;

        if (siteSetting) {
          await strapi.entityService.update('api::site-setting.site-setting', siteSetting.id, {
            data: {
              contactEmail: "retourgagnant2bj@gmail.com",
              contactPhone: "+229 0160322121",
              contactAddress: "Haie-Vive Cocotiers, Carré n°1158",
              contactHours: "Lun - Ven : 8h - 18h"
            }
          });
          console.log('✅ Site Settings (Contact) updated successfully.');
        } else {
          await strapi.entityService.create('api::site-setting.site-setting', {
            data: {
              contactEmail: "retourgagnant2bj@gmail.com",
              contactPhone: "+229 0160322121",
              contactAddress: "Haie-Vive Cocotiers, Carré n°1158",
              contactHours: "Lun - Ven : 8h - 18h",
              // Defaults for others
              audioVolume: 15,
              audioEnabled: true
            }
          });
          console.log('✅ Site Settings created with Contact info.');
        }
      } catch (err) {
        console.error('⚠️ Failed to update Site Settings:', err);
      }

    } catch (error) {
      console.error('❌ Bootstrap error:', error);
    }
  },
};
