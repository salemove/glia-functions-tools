import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import GliaApiClient from '../../../src/lib/api.js';
import { FunctionError } from '../../../src/lib/errors.js';

// Import our custom fetch mock
import '../../setup/mockFetch.js';

describe('GliaApiClient - Applet Methods', () => {
  // Setup test configuration
  const config = {
    apiUrl: 'https://test-api.glia.com',
    siteId: 'test-site-id',
    bearerToken: 'test-bearer-token'
  };
  
  let api;
  
  beforeEach(() => {
    // Reset the fetch mock between tests
    global.fetch.mockClear();
    
    // Create a new API client with logging level set to silent for tests
    api = new GliaApiClient({
      ...config,
      logging: {
        level: 'silent' // Don't show logs during tests
      }
    });
    
    // Disable actual offline manager
    api.offlineManager = null;
  });
  
  describe('listApplets', () => {
    it('should fetch applets with no options', async () => {
      const mockResponse = {
        axons: [
          { id: 'applet1', name: 'Applet 1' },
          { id: 'applet2', name: 'Applet 2' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listApplets();
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should fetch applets with siteId filter', async () => {
      const mockResponse = {
        axons: [
          { id: 'applet1', name: 'Applet 1' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listApplets({ siteId: 'filter-site-id' });
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons?site_id=filter-site-id`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should fetch applets with scope filter', async () => {
      const mockResponse = {
        axons: [
          { id: 'applet1', name: 'Applet 1' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listApplets({ scope: 'engagement' });
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons?scope=engagement`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should fetch applets with multiple filters', async () => {
      const mockResponse = {
        axons: [
          { id: 'applet1', name: 'Applet 1' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listApplets({ siteId: 'filter-site-id', scope: 'engagement' });
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons?site_id=filter-site-id&scope=engagement`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.listApplets()).rejects.toThrow(FunctionError);
      await expect(api.listApplets()).rejects.toThrow('Failed to list applets');
    });
  });
  
  describe('getApplet', () => {
    it('should fetch an applet by ID', async () => {
      const appletId = 'test-applet-id';
      const mockResponse = { id: appletId, name: 'Test Applet' };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.getApplet(appletId);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons/${appletId}`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.getApplet('test-id')).rejects.toThrow(FunctionError);
      await expect(api.getApplet('test-id')).rejects.toThrow('Failed to get applet');
    });
    
    it('should validate applet ID', async () => {
      await expect(api.getApplet()).rejects.toThrow('Applet ID is required');
    });
  });
  
  describe('createApplet', () => {
    it('should create an applet with HTML source', async () => {
      const options = {
        name: 'Test Applet',
        description: 'Test description',
        ownerSiteId: 'test-site-id',
        source: '<html>Test</html>',
        scope: 'engagement'
      };
      const mockResponse = { id: 'new-applet-id', name: options.name };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      // Mock FormData since it's not available in Jest environment
      global.FormData = class {
        constructor() {
          this.data = {};
          this.append = jest.fn((key, value, options) => {
            this.data[key] = value;
            if (options) this.data[key + '_options'] = options;
          });
          this.getHeaders = jest.fn(() => {
            return { 'content-type': 'multipart/form-data; boundary=--boundary' };
          });
        }
      };
      
      const result = await api.createApplet(options);
      
      // Check that the right endpoint was called with POST method
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons`, expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-bearer-token'
        })
      }));
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should create an applet with source URL', async () => {
      const options = {
        name: 'Test Applet',
        description: 'Test description',
        ownerSiteId: 'test-site-id',
        sourceUrl: 'https://example.com/applet.html',
        scope: 'global'
      };
      const mockResponse = { id: 'new-applet-id', name: options.name };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      // Mock FormData
      global.FormData = class {
        constructor() {
          this.data = {};
          this.append = jest.fn((key, value, options) => {
            this.data[key] = value;
            if (options) this.data[key + '_options'] = options;
          });
          this.getHeaders = jest.fn(() => {
            return { 'content-type': 'multipart/form-data; boundary=--boundary' };
          });
        }
      };
      
      const result = await api.createApplet(options);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons`, expect.objectContaining({
        method: 'POST'
      }));
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate required fields', async () => {
      await expect(api.createApplet({})).rejects.toThrow('Applet name is required');
      await expect(api.createApplet({ name: 'Test' })).rejects.toThrow('Owner site ID is required');
      await expect(api.createApplet({ name: 'Test', ownerSiteId: 'site-id' })).rejects.toThrow('Either source or sourceUrl is required');
    });
    
    it('should throw FunctionError on failure', async () => {
      const options = {
        name: 'Test Applet',
        ownerSiteId: 'test-site-id',
        source: '<html>Test</html>'
      };
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.createApplet(options)).rejects.toThrow(FunctionError);
      await expect(api.createApplet(options)).rejects.toThrow('Failed to create applet');
    });
  });
  
  describe('updateApplet', () => {
    it('should update an applet', async () => {
      const appletId = 'test-applet-id';
      const options = {
        name: 'Updated Applet',
        description: 'Updated description',
        source: '<html>Updated</html>'
      };
      const mockResponse = { id: appletId, name: options.name };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      // Mock FormData
      global.FormData = class {
        constructor() {
          this.data = {};
          this.append = jest.fn((key, value, options) => {
            this.data[key] = value;
            if (options) this.data[key + '_options'] = options;
          });
          this.getHeaders = jest.fn(() => {
            return { 'content-type': 'multipart/form-data; boundary=--boundary' };
          });
        }
      };
      
      const result = await api.updateApplet(appletId, options);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons/${appletId}`, expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-bearer-token'
        })
      }));
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate applet ID', async () => {
      const options = { name: 'Updated Applet' };
      await expect(api.updateApplet(null, options)).rejects.toThrow('Applet ID is required');
    });
    
    it('should throw FunctionError on failure', async () => {
      const appletId = 'test-applet-id';
      const options = { name: 'Updated Applet' };
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.updateApplet(appletId, options)).rejects.toThrow(FunctionError);
      await expect(api.updateApplet(appletId, options)).rejects.toThrow('Failed to update applet');
    });
  });
  
  describe('deleteApplet', () => {
    it('should delete an applet', async () => {
      const appletId = 'test-applet-id';
      const mockResponse = { success: true };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.deleteApplet(appletId);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/axons/${appletId}`, expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-bearer-token'
        })
      }));
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate applet ID', async () => {
      await expect(api.deleteApplet()).rejects.toThrow('Applet ID is required');
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.deleteApplet('test-id')).rejects.toThrow(FunctionError);
      await expect(api.deleteApplet('test-id')).rejects.toThrow('Failed to delete applet');
    });
  });
  
  describe('addAppletToSite', () => {
    it('should add an applet to a site', async () => {
      const siteId = 'test-site-id';
      const appletId = 'test-applet-id';
      const mockResponse = { success: true };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.addAppletToSite(siteId, appletId);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/sites/${siteId}/axons`, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ axon_id: appletId }),
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-bearer-token',
          'Content-Type': 'application/json'
        })
      }));
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate site ID and applet ID', async () => {
      await expect(api.addAppletToSite()).rejects.toThrow('Site ID is required');
      await expect(api.addAppletToSite('site-id')).rejects.toThrow('Applet ID is required');
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.addAppletToSite('site-id', 'applet-id')).rejects.toThrow(FunctionError);
      await expect(api.addAppletToSite('site-id', 'applet-id')).rejects.toThrow('Failed to add applet to site');
    });
  });
  
  describe('listSiteApplets', () => {
    it('should list applets for a site', async () => {
      const siteId = 'test-site-id';
      const mockResponse = {
        axons: [
          { id: 'applet1', name: 'Applet 1' },
          { id: 'applet2', name: 'Applet 2' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listSiteApplets(siteId);
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/sites/${siteId}/axons`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should list applets with scope filter', async () => {
      const siteId = 'test-site-id';
      const mockResponse = {
        axons: [
          { id: 'applet1', name: 'Applet 1' }
        ]
      };
      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));
      
      const result = await api.listSiteApplets(siteId, { scope: 'engagement' });
      
      expect(fetchMock).toHaveBeenCalledWith(`${config.apiUrl}/sites/${siteId}/axons?scope=engagement`, expect.any(Object));
      expect(result).toEqual(mockResponse);
    });
    
    it('should validate site ID', async () => {
      await expect(api.listSiteApplets()).rejects.toThrow('Site ID is required');
    });
    
    it('should throw FunctionError on failure', async () => {
      fetchMock.mockReject(new Error('Network failure'));
      
      await expect(api.listSiteApplets('site-id')).rejects.toThrow(FunctionError);
      await expect(api.listSiteApplets('site-id')).rejects.toThrow('Failed to list site applets');
    });
  });
});